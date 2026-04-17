<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;

class RoleMiddleware
{
    public function __construct(private string|array $requiredRole = 'admin')
    {
    }

    public function handle(): void
    {
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $requiredRoles = is_array($this->requiredRole) ? $this->requiredRole : [$this->requiredRole];

        if (!in_array($role, $requiredRoles, true)) {
            Response::json(['message' => 'Forbidden'], 403);
        }
    }
}
