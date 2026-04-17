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

        if ($role === 'super_admin') {
            $totalCollected = (float)($pdo->query('SELECT COALESCE(SUM(amount_paid), 0) AS total FROM payments')->fetch()['total'] ?? 0);
            $totalUnpaid = (float)($pdo->query("SELECT COALESCE(SUM(remaining_amount), 0) AS total FROM monthly_fees WHERE status != 'PAID'")->fetch()['total'] ?? 0);
            $lateStudents = (int)($pdo->query("SELECT COUNT(DISTINCT student_id) AS total FROM monthly_fees WHERE status != 'PAID'")->fetch()['total'] ?? 0);
        } else {
            $stmtCollected = $pdo->prepare('SELECT COALESCE(SUM(amount_paid), 0) AS total FROM payments WHERE school_id = ?');
            $stmtCollected->execute([$schoolId]);
            $totalCollected = (float)($stmtCollected->fetch()['total'] ?? 0);

            $stmtUnpaid = $pdo->prepare("SELECT COALESCE(SUM(remaining_amount), 0) AS total FROM monthly_fees WHERE school_id = ? AND status != 'PAID'");
            $stmtUnpaid->execute([$schoolId]);
            $totalUnpaid = (float)($stmtUnpaid->fetch()['total'] ?? 0);

            $stmtLate = $pdo->prepare("SELECT COUNT(DISTINCT student_id) AS total FROM monthly_fees WHERE school_id = ? AND status != 'PAID'");
            $stmtLate->execute([$schoolId]);
            $lateStudents = (int)($stmtLate->fetch()['total'] ?? 0);
        }

        return [
            'total_collected' => $totalCollected,
            'total_unpaid' => $totalUnpaid,
            'late_students' => $lateStudents,
        ];
    }
}
