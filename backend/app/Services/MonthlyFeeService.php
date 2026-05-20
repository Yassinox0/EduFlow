<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;

class MonthlyFeeService
{
    public function getAll(array $filters = []): array
    {
        [$role, $schoolId] = $this->authScope();
        $pdo = Database::connect();

        $conditions = [];
        $params = [];

        if ($role !== 'super_admin') {
            $conditions[] = 'mf.school_id = ?';
            $params[] = $schoolId;
        }

        if (!empty($filters['month_label'])) {
            $conditions[] = 'mf.month_label = ?';
            $params[] = (string)$filters['month_label'];
        }

        if (!empty($filters['year_value'])) {
            $conditions[] = 'mf.year_value = ?';
            $params[] = (int)$filters['year_value'];
        }

        if (!empty($filters['status'])) {
            $conditions[] = 'mf.status = ?';
            $params[] = (string)$filters['status'];
        }

        $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $sql = "
            SELECT
                mf.*,
                s.first_name,
                s.last_name,
                s.parent_name,
                s.phone,
                s.school_year,
                s.discount_percent,
                COALESCE(cl.name, s.class_level) AS class_level_name
            FROM monthly_fees mf
            INNER JOIN students s ON s.id = mf.student_id
            LEFT JOIN class_levels cl ON cl.id = s.class_level_id
            {$whereSql}
            ORDER BY mf.id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function generateForMonth(string $monthLabel, int $yearValue): array
    {
        [$role, $schoolId] = $this->authScope();
        if ($role === 'super_admin' && !$schoolId) {
            return ['error' => 'school_id is required for super_admin'];
        }

        $pdo = Database::connect();

        $studentsStmt = $pdo->prepare('
            SELECT id, monthly_amount, discount_percent, status
            FROM students
            WHERE school_id = ?
        ');
        $studentsStmt->execute([$schoolId]);
        $students = $studentsStmt->fetchAll();

        $created = 0;
        foreach ($students as $student) {
            if (($student['status'] ?? 'ACTIVE') !== 'ACTIVE') {
                continue;
            }

            $existsStmt = $pdo->prepare('SELECT id FROM monthly_fees WHERE school_id = ? AND student_id = ? AND month_label = ? AND year_value = ? LIMIT 1');
            $existsStmt->execute([$schoolId, $student['id'], $monthLabel, $yearValue]);
            if ($existsStmt->fetch()) {
                continue;
            }

            $amount = $this->netAmountFromStudent((float)$student['monthly_amount'], (float)($student['discount_percent'] ?? 0));
            $insert = $pdo->prepare('
                INSERT INTO monthly_fees (school_id, student_id, month_label, year_value, total_amount, amount_paid, remaining_amount, status)
                VALUES (?, ?, ?, ?, ?, 0, ?, "UNPAID")
            ');
            $insert->execute([$schoolId, $student['id'], $monthLabel, $yearValue, $amount, $amount]);
            $created++;
        }

        return [
            'school_id' => $schoolId,
            'month_label' => $monthLabel,
            'year_value' => $yearValue,
            'created_fees' => $created,
            'message' => 'Monthly fees generated',
        ];
    }

    public function getUnpaid(): array
    {
        [$role, $schoolId] = $this->authScope();
        $pdo = Database::connect();

        $sql = '
            SELECT
                mf.id,
                mf.school_id,
                mf.student_id,
                mf.month_label,
                mf.year_value,
                mf.total_amount,
                mf.amount_paid,
                mf.remaining_amount,
                mf.status,
                s.first_name,
                s.last_name,
                s.parent_name,
                s.phone,
                CASE
                    WHEN mf.month_label REGEXP "^[0-9]{1,2}$" THEN
                        STR_TO_DATE(
                            CONCAT(
                                mf.year_value, "-",
                                LPAD(mf.month_label, 2, "0"), "-",
                                LPAD(
                                    LEAST(
                                        DAY(s.created_at),
                                        DAY(LAST_DAY(STR_TO_DATE(CONCAT(mf.year_value, "-", LPAD(mf.month_label, 2, "0"), "-01"), "%Y-%m-%d")))
                                    ),
                                    2,
                                    "0"
                                )
                            ),
                            "%Y-%m-%d"
                        )
                    ELSE NULL
                END AS due_date,
                CASE
                    WHEN mf.month_label REGEXP "^[0-9]{1,2}$" THEN
                        GREATEST(
                            DATEDIFF(
                                CURDATE(),
                                STR_TO_DATE(
                                    CONCAT(
                                        mf.year_value, "-",
                                        LPAD(mf.month_label, 2, "0"), "-",
                                        LPAD(
                                            LEAST(
                                                DAY(s.created_at),
                                                DAY(LAST_DAY(STR_TO_DATE(CONCAT(mf.year_value, "-", LPAD(mf.month_label, 2, "0"), "-01"), "%Y-%m-%d")))
                                            ),
                                            2,
                                            "0"
                                        )
                                    ),
                                    "%Y-%m-%d"
                                )
                            ),
                            0
                        )
                    ELSE NULL
                END AS days_late
            FROM monthly_fees mf
            INNER JOIN students s ON s.id = mf.student_id
            WHERE mf.status != "PAID"
        ';

        $sql .= ' AND (
            CASE
                WHEN mf.month_label REGEXP "^[0-9]{1,2}$" THEN
                    STR_TO_DATE(
                        CONCAT(
                            mf.year_value, "-",
                            LPAD(mf.month_label, 2, "0"), "-",
                            LPAD(
                                LEAST(
                                    DAY(s.created_at),
                                    DAY(LAST_DAY(STR_TO_DATE(CONCAT(mf.year_value, "-", LPAD(mf.month_label, 2, "0"), "-01"), "%Y-%m-%d")))
                                ),
                                2,
                                "0"
                            )
                        ),
                        "%Y-%m-%d"
                    )
                ELSE NULL
            END
        ) <= CURDATE()';

        if ($role !== 'super_admin') {
            $sql .= ' AND mf.school_id = ?';
            $stmt = $pdo->prepare($sql . ' ORDER BY due_date ASC, mf.year_value ASC, mf.month_label ASC, mf.id ASC');
            $stmt->execute([$schoolId]);
            return $stmt->fetchAll();
        }

        $stmt = $pdo->query($sql . ' ORDER BY due_date ASC, mf.year_value ASC, mf.month_label ASC, mf.id ASC');
        return $stmt->fetchAll();
    }

    public function resolveOrCreateFee(int $schoolId, int $studentId, ?int $monthlyFeeId, ?string $monthLabel, ?int $yearValue): array
    {
        $pdo = Database::connect();

        if ($monthlyFeeId !== null && $monthlyFeeId > 0) {
            $stmt = $pdo->prepare('
                SELECT id, total_amount, amount_paid, remaining_amount, status
                FROM monthly_fees
                WHERE id = ? AND school_id = ? AND student_id = ?
                LIMIT 1
            ');
            $stmt->execute([$monthlyFeeId, $schoolId, $studentId]);
            $fee = $stmt->fetch();
            if (!$fee) {
                return ['error' => 'Monthly fee not found for this school/student'];
            }
            return ['fee' => $fee];
        }

        if (!$monthLabel || !$yearValue) {
            return ['error' => 'monthly_fee_id or (month_label and year_value) is required'];
        }

        $exists = $pdo->prepare('
            SELECT id, total_amount, amount_paid, remaining_amount, status
            FROM monthly_fees
            WHERE school_id = ? AND student_id = ? AND month_label = ? AND year_value = ?
            LIMIT 1
        ');
        $exists->execute([$schoolId, $studentId, $monthLabel, $yearValue]);
        $fee = $exists->fetch();
        if ($fee) {
            return ['fee' => $fee];
        }

        $studentStmt = $pdo->prepare('
            SELECT monthly_amount, discount_percent, status
            FROM students
            WHERE id = ? AND school_id = ?
            LIMIT 1
        ');
        $studentStmt->execute([$studentId, $schoolId]);
        $student = $studentStmt->fetch();
        if (!$student) {
            return ['error' => 'Student not found for this school'];
        }

        if (($student['status'] ?? 'ACTIVE') !== 'ACTIVE') {
            return ['error' => 'Inactive student cannot receive monthly fee'];
        }

        $amount = $this->netAmountFromStudent((float)$student['monthly_amount'], (float)($student['discount_percent'] ?? 0));
        $insert = $pdo->prepare('
            INSERT INTO monthly_fees (school_id, student_id, month_label, year_value, total_amount, amount_paid, remaining_amount, status)
            VALUES (?, ?, ?, ?, ?, 0, ?, "UNPAID")
        ');
        $insert->execute([$schoolId, $studentId, $monthLabel, $yearValue, $amount, $amount]);

        return [
            'fee' => [
                'id' => (int)$pdo->lastInsertId(),
                'total_amount' => $amount,
                'amount_paid' => 0,
                'remaining_amount' => $amount,
                'status' => 'UNPAID',
            ],
        ];
    }

    public function authScope(): array
    {
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;
        return [$role, $schoolId];
    }

    private function netAmountFromStudent(float $monthlyAmount, float $discountPercent): float
    {
        $discountPercent = max(0.0, min(100.0, $discountPercent));
        $net = $monthlyAmount * ((100.0 - $discountPercent) / 100.0);
        return round(max(0.0, $net), 2);
    }
}
