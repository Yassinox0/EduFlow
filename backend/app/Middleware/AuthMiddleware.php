<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Database;
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
            $userId = (int)($decoded->id ?? 0);
            $statement = Database::connect()->prepare(
                'SELECT id, school_id, email, role, status, must_change_password, token_version '
                . 'FROM users WHERE id = ? LIMIT 1'
            );
            $statement->execute([$userId]);
            $user = $statement->fetch();
            if (!$user || $user['status'] !== 'ACTIVE') {
                Response::json(['message' => 'Unauthorized'], 401);
            }
            if ((int)($decoded->token_version ?? 1) !== (int)$user['token_version']) {
                Response::json(['message' => 'Session expired'], 401);
            }

            Request::set('auth_user', [
                'id' => (int)$user['id'],
                'email' => (string)$user['email'],
                'role' => (string)$user['role'],
                'school_id' => $user['school_id'] !== null ? (int)$user['school_id'] : null,
                'must_change_password' => (bool)$user['must_change_password'],
            ]);

            $allowedActivationPaths = ['/api/account/profile', '/api/account/password', '/api/account/photo'];
            $path = parse_url(Request::uri(), PHP_URL_PATH) ?: '';
            if ((bool)$user['must_change_password'] && !in_array($path, $allowedActivationPaths, true)) {
                Response::json([
                    'message' => 'Password change required',
                    'code' => 'PASSWORD_CHANGE_REQUIRED',
                ], 428);
            }
        } catch (\Throwable $e) {
            Response::json(['message' => 'Invalid or expired token'], 401);
        }
    }
}
