<?php

declare(strict_types=1);

namespace App\Controllers;

use App\CoreDatabase;
use App\CoreRequest;
use App\Core\Response;

class PermissionController
{
    public function mine(): void
    {
        $role = (string) (Request::get('auth_user', [])['role'] ?? '');
        if ($role === 'super_admin') {
            $permissions = Database::connect()->query('SELECT code FROM permissions ORDER BY code')->fetchAll(\PDO::FETCH_COLUMN);
        } else {
            $stmt = Database::connect()->prepare('SELECT p.code FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id WHERE rp.role = ? ORDER BY p.code');
            $stmt->execute([$role]);
            $permissions = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        }
        Response::json(['permissions' => $permissions]);
    }
}
