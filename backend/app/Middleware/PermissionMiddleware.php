<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

class PermissionMiddleware
{
    public function __construct(private string $permission)
    {
    }

    public function handle(): void
    {
        $user = Request::get('auth_user', []);
        if (($user['role'] ?? '') === 'super_admin') {
            return;
        }

        $stmt = Database::connect()->prepare('
            SELECT 1 FROM role_permissions rp
            INNER JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role = ? AND p.code = ? LIMIT 1
        ');
        $stmt->execute([(string)($user['role'] ?? ''), $this->permission]);
        if (!$stmt->fetchColumn()) {
            Response::json(['message' => 'Forbidden: missing permission ' . $this->permission], 403);
        }
    }
}
