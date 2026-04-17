<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

class MonthlyFeeController
{
    public function index(): void
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            $fees = $pdo->query('SELECT * FROM monthly_fees ORDER BY id DESC')->fetchAll();
            Response::json($fees);
        }

        $stmt = $pdo->prepare('SELECT * FROM monthly_fees WHERE school_id = ? ORDER BY id DESC');
        $stmt->execute([$schoolId]);
        $fees = $stmt->fetchAll();
        Response::json($fees);
    }
}
