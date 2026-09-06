<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\JwtHandler;
use App\Core\Request;

class AccountService
{
    public function profile(): array
    {
        $userId = (int)(Request::get('auth_user', [])['id'] ?? 0);
        $stmt = Database::connect()->prepare('
            SELECT u.id, u.school_id, u.first_name, u.last_name, u.email, u.role, u.status,
                   u.gender, u.phone, u.address, u.primary_school, u.photo_path,
                   u.must_change_password, u.password_changed_at,
                   s.name AS school_name, s.logo_path AS school_logo_path
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            WHERE u.id = ?
            LIMIT 1
        ');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) {
            return ['error' => 'Account not found'];
        }
        $user['must_change_password'] = (bool)$user['must_change_password'];
        return $user;
    }

    public function changePassword(array $data): array
    {
        $currentPassword = (string)($data['current_password'] ?? '');
        $newPassword = (string)($data['new_password'] ?? '');
        $confirmation = (string)($data['new_password_confirmation'] ?? '');
        if ($currentPassword === '' || $newPassword === '' || $confirmation === '') {
            return ['error' => 'All password fields are required'];
        }
        if ($newPassword !== $confirmation) {
            return ['error' => 'Password confirmation does not match'];
        }
        if (strlen($newPassword) < 10
            || !preg_match('/[a-z]/', $newPassword)
            || !preg_match('/[A-Z]/', $newPassword)
            || !preg_match('/\d/', $newPassword)
            || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
            return ['error' => 'Password must contain at least 10 characters, uppercase, lowercase, number and symbol'];
        }

        $pdo = Database::connect();
        $userId = (int)(Request::get('auth_user', [])['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($currentPassword, $user['password'])) {
            return ['error' => 'Current password is incorrect'];
        }
        if (password_verify($newPassword, $user['password'])) {
            return ['error' => 'New password must be different'];
        }

        $newVersion = (int)($user['token_version'] ?? 1) + 1;
        $stmt = $pdo->prepare('
            UPDATE users
            SET password = ?, must_change_password = 0, password_changed_at = NOW(), token_version = ?
            WHERE id = ?
        ');
        $stmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), $newVersion, $userId]);

        $ttl = (int)($_ENV['JWT_TTL'] ?? 86400);
        $payload = [
            'id' => $userId,
            'email' => $user['email'],
            'role' => $user['role'],
            'school_id' => $user['school_id'] !== null ? (int)$user['school_id'] : null,
            'token_version' => $newVersion,
            'iat' => time(),
            'exp' => time() + $ttl,
        ];

        return [
            'message' => 'Password changed successfully',
            'token' => JwtHandler::encode($payload),
            'user' => array_merge($this->profile(), ['must_change_password' => false]),
        ];
    }

    public function photoStorageContext(): array
    {
        $profile = $this->profile();
        return isset($profile['error']) ? $profile : [
            'id' => (int)$profile['id'],
            'school_id' => (int)$profile['school_id'],
            'first_name' => $profile['first_name'],
            'last_name' => $profile['last_name'],
            'photo_path' => $profile['photo_path'],
        ];
    }

    public function updatePhoto(string $path): array
    {
        $userId = (int)(Request::get('auth_user', [])['id'] ?? 0);
        $stmt = Database::connect()->prepare('UPDATE users SET photo_path = ? WHERE id = ?');
        $stmt->execute([$path, $userId]);
        return ['photo_path' => $path, 'message' => 'Profile photo updated'];
    }
}
