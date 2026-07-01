<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

class SuperAdminService
{
    public function dashboard(): array
    {
        $pdo = Database::connect();

        $schoolsTotal = (int)($pdo->query('SELECT COUNT(*) AS total FROM schools')->fetch()['total'] ?? 0);
        $schoolsActive = (int)($pdo->query("SELECT COUNT(*) AS total FROM schools WHERE status = 'ACTIVE'")->fetch()['total'] ?? 0);
        $usersTotal = (int)($pdo->query('SELECT COUNT(*) AS total FROM users')->fetch()['total'] ?? 0);
        $usersActive = (int)($pdo->query("SELECT COUNT(*) AS total FROM users WHERE status = 'ACTIVE'")->fetch()['total'] ?? 0);
        $totalCollected = (float)($pdo->query('SELECT COALESCE(SUM(amount_paid), 0) AS total FROM payments')->fetch()['total'] ?? 0);
        $outstandingBalance = (float)($pdo->query("SELECT COALESCE(SUM(remaining_amount), 0) AS total FROM monthly_fees WHERE status != 'PAID'")->fetch()['total'] ?? 0);

        return [
            'schools_total' => $schoolsTotal,
            'schools_active' => $schoolsActive,
            'users_total' => $usersTotal,
            'users_active' => $usersActive,
            'total_collected' => $totalCollected,
            'outstanding_balance' => $outstandingBalance,
        ];
    }
}
