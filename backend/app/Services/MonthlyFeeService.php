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
            SELECT mf.*, s.first_name, s.last_name, s.parent_name, s.phone
            FROM monthly_fees mf
            INNER JOIN students s ON s.id = mf.student_id
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

        $studentsStmt = $pdo->prepare('SELECT id, monthly_amount FROM students WHERE school_id = ?');
        $studentsStmt->execute([$schoolId]);
        $students = $studentsStmt->fetchAll();

        $created = 0;
        foreach ($students as $student) {
            $existsStmt = $pdo->prepare('SELECT id FROM monthly_fees WHERE school_id = ? AND student_id = ? AND month_label = ? AND year_value = ? LIMIT 1');
            $existsStmt->execute([$schoolId, $student['id'], $monthLabel, $yearValue]);
            if ($existsStmt->fetch()) {
                continue;
            }

            $amount = (float)$student['monthly_amount'];
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
                        GREATEST(
                            DATEDIFF(
                                CURDATE(),
                                STR_TO_DATE(CONCAT(mf.year_value, "-", LPAD(mf.month_label, 2, "0"), "-10"), "%Y-%m-%d")
                            ),
                            0
                        )
                    ELSE NULL
                END AS days_late
            FROM monthly_fees mf
            INNER JOIN students s ON s.id = mf.student_id
            WHERE mf.status != "PAID"
        ';

        if ($role !== 'super_admin') {
            $sql .= ' AND mf.school_id = ?';
            $stmt = $pdo->prepare($sql . ' ORDER BY mf.year_value DESC, mf.month_label DESC, mf.id DESC');
            $stmt->execute([$schoolId]);
            return $stmt->fetchAll();
        }

        $stmt = $pdo->query($sql . ' ORDER BY mf.year_value DESC, mf.month_label DESC, mf.id DESC');
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

        $studentStmt = $pdo->prepare('SELECT monthly_amount FROM students WHERE id = ? AND school_id = ? LIMIT 1');
        $studentStmt->execute([$studentId, $schoolId]);
        $student = $studentStmt->fetch();
        if (!$student) {
            return ['error' => 'Student not found for this school'];
        }

        $amount = (float)$student['monthly_amount'];
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
}
