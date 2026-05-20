<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDOException;

class ClassLevelService
{
    public function getAll(?int $requestedSchoolId = null): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $actorSchoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            if ($requestedSchoolId && $requestedSchoolId > 0) {
                $stmt = $pdo->prepare('SELECT * FROM class_levels WHERE school_id = ? ORDER BY sort_order ASC, name ASC');
                $stmt->execute([$requestedSchoolId]);
                return $stmt->fetchAll();
            }

            $stmt = $pdo->query('SELECT * FROM class_levels ORDER BY school_id ASC, sort_order ASC, name ASC');
            return $stmt->fetchAll();
        }

        $stmt = $pdo->prepare('SELECT * FROM class_levels WHERE school_id = ? ORDER BY sort_order ASC, name ASC');
        $stmt->execute([$actorSchoolId]);
        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $actorSchoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        $schoolId = $actorSchoolId;
        if ($role === 'super_admin') {
            $schoolId = isset($data['school_id']) ? (int)$data['school_id'] : null;
        }

        if (!$schoolId || $schoolId <= 0) {
            return ['error' => 'school_id is required'];
        }

        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') {
            return ['error' => 'Class level name is required'];
        }

        $status = 'ACTIVE';
        $nextSortOrderStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_value FROM class_levels WHERE school_id = ?');
        $nextSortOrderStmt->execute([$schoolId]);
        $nextSortOrder = (int)($nextSortOrderStmt->fetch()['next_value'] ?? 1);
        $sortOrder = $nextSortOrder;
        $code = (string)$nextSortOrder;

        try {
            $stmt = $pdo->prepare('
                INSERT INTO class_levels (school_id, name, code, sort_order, status)
                VALUES (?, ?, ?, ?, ?)
            ');
            $stmt->execute([
                $schoolId,
                $name,
                $code,
                $sortOrder,
                $status,
            ]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? null) === 1146) {
                return ['error' => 'Table class_levels absente. Lancez la migration 2026_05_11_user_student_payment_upgrade.sql'];
            }
            if ((int)$e->getCode() === 23000) {
                return ['error' => 'Class level already exists for this school'];
            }
            return ['error' => 'Class level creation failed'];
        }

        return [
            'id' => (int)$pdo->lastInsertId(),
            'school_id' => $schoolId,
            'name' => $name,
            'code' => $code,
            'sort_order' => $sortOrder,
            'status' => $status,
            'message' => 'Class level created successfully',
        ];
    }
}
