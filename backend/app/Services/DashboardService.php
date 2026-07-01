<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;

class DashboardService
{
    public function stats(): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        $isSuperAdmin = ($role === 'super_admin');
        $params = $isSuperAdmin ? [] : [$schoolId];
        $whereSchool = $isSuperAdmin ? '' : ' WHERE school_id = ?';
        $whereSchoolAnd = $isSuperAdmin ? ' WHERE ' : ' WHERE school_id = ? AND ';

        $stmtCollected = $pdo->prepare("SELECT COALESCE(SUM(amount_paid), 0) AS total FROM payments{$whereSchool}");
        $stmtCollected->execute($params);
        $totalCollected = (float)($stmtCollected->fetch()['total'] ?? 0);

        $stmtUnpaid = $pdo->prepare("SELECT COALESCE(SUM(remaining_amount), 0) AS total FROM monthly_fees{$whereSchoolAnd}status != 'PAID'");
        $stmtUnpaid->execute($params);
        $totalUnpaid = (float)($stmtUnpaid->fetch()['total'] ?? 0);

        $stmtLate = $pdo->prepare("SELECT COUNT(DISTINCT student_id) AS total FROM monthly_fees{$whereSchoolAnd}status != 'PAID'");
        $stmtLate->execute($params);
        $lateStudents = (int)($stmtLate->fetch()['total'] ?? 0);

        $stmtStudents = $pdo->prepare("SELECT COUNT(*) AS total FROM students{$whereSchool}");
        $stmtStudents->execute($params);
        $studentsCount = (int)($stmtStudents->fetch()['total'] ?? 0);

        $stmtPayments = $pdo->prepare("SELECT COUNT(*) AS total FROM payments{$whereSchool}");
        $stmtPayments->execute($params);
        $paymentsCount = (int)($stmtPayments->fetch()['total'] ?? 0);

        $coverageRate = ($totalCollected + $totalUnpaid) > 0
            ? round(($totalCollected / ($totalCollected + $totalUnpaid)) * 100, 2)
            : 0.0;

        $recentSql = "
            SELECT
                p.id,
                p.amount_paid,
                p.payment_date,
                p.payment_method,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name
            FROM payments p
            JOIN students s ON s.id = p.student_id
            " . ($isSuperAdmin ? "" : "WHERE p.school_id = ?") . "
            ORDER BY p.payment_date DESC, p.id DESC
            LIMIT 5
        ";
        $stmtRecent = $pdo->prepare($recentSql);
        $stmtRecent->execute($params);
        $recentPayments = $stmtRecent->fetchAll();

        $unpaidSql = "
            SELECT
                mf.student_id,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                COALESCE(SUM(mf.remaining_amount), 0) AS total_remaining
            FROM monthly_fees mf
            JOIN students s ON s.id = mf.student_id
            WHERE mf.status != 'PAID'
            " . ($isSuperAdmin ? "" : "AND mf.school_id = ?") . "
            GROUP BY mf.student_id, s.first_name, s.last_name
            ORDER BY total_remaining DESC
            LIMIT 5
        ";
        $stmtUnpaidTop = $pdo->prepare($unpaidSql);
        $stmtUnpaidTop->execute($params);
        $topUnpaidStudents = $stmtUnpaidTop->fetchAll();

        return [
            'total_collected' => $totalCollected,
            'total_unpaid' => $totalUnpaid,
            'late_students' => $lateStudents,
            'students_count' => $studentsCount,
            'payments_count' => $paymentsCount,
            'coverage_rate' => $coverageRate,
            'recent_payments' => $recentPayments,
            'top_unpaid_students' => $topUnpaidStudents,
        ];
    }
}
