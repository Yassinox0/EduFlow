<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\JwtHandler;

class AuthService
{
    public function login(string $email, string $password): array|false
    {
        $pdo = Database::connect();
        $stmt = $pdo->prepare('SELECT u.*, s.name AS school_name, s.code AS school_code, s.email_domain AS school_email_domain, s.logo_path AS school_logo_path, s.status AS school_status FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            return false;
        }

        if (($user['status'] ?? 'ACTIVE') !== 'ACTIVE') {
            return false;
        }

        if ($user['role'] !== 'super_admin' && ($user['school_status'] ?? 'INACTIVE') !== 'ACTIVE') {
            return false;
        }

        $ttl = (int)($_ENV['JWT_TTL'] ?? 86400);
        $payload = [
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'school_id' => $user['school_id'] !== null ? (int)$user['school_id'] : null,
            'iat' => time(),
            'exp' => time() + $ttl,
        ];

        return [
            'token' => JwtHandler::encode($payload),
            'user' => [
                'id' => (int)$user['id'],
                'school_id' => $user['school_id'] !== null ? (int)$user['school_id'] : null,
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'status' => $user['status'],
                'school_name' => $user['school_name'],
                'school_code' => $user['school_code'],
                'school_email_domain' => $user['school_email_domain'],
                'school_logo_path' => $user['school_logo_path'],
            ],
        ];
    }
}
