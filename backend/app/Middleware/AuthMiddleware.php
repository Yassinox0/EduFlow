<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\JwtHandler;
use App\Core\Request;
use App\Core\Response;

class AuthMiddleware
{
    public function handle(): void
    {
        $header = Request::header('Authorization');

        if (!$header || !str_starts_with($header, 'Bearer ')) {
            Response::json(['message' => 'Unauthorized'], 401);
        }

        $token = trim(str_replace('Bearer ', '', $header));

        try {
            $decoded = JwtHandler::decode($token);
            Request::set('auth_user', [
                'id' => (int)($decoded->id ?? 0),
                'email' => (string)($decoded->email ?? ''),
                'role' => (string)($decoded->role ?? ''),
                'school_id' => isset($decoded->school_id) ? (int)$decoded->school_id : null,
            ]);
        } catch (\Throwable $e) {
            Response::json(['message' => 'Invalid or expired token'], 401);
        }
    }
}
