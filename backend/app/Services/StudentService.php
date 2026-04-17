<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;

class StudentService
{
    public function getAll(): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            $stmt = $pdo->query('SELECT * FROM students ORDER BY id DESC');
            return $stmt->fetchAll();
        }

        $stmt = $pdo->prepare('SELECT * FROM students WHERE school_id = ? ORDER BY id DESC');
        $stmt->execute([$schoolId]);
        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            $schoolId = isset($data['school_id']) ? (int)$data['school_id'] : null;
        }

        if (!$schoolId) {
            return ['error' => 'School is required to create student'];
        }

        $stmt = $pdo->prepare('INSERT INTO students (school_id, first_name, last_name, class_level, parent_name, phone, monthly_amount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $schoolId,
            $data['first_name'] ?? '',
            $data['last_name'] ?? '',
            $data['class_level'] ?? '',
            $data['parent_name'] ?? '',
            $data['phone'] ?? null,
            $data['monthly_amount'] ?? 0,
        ]);

        return [
            'id' => (int)$pdo->lastInsertId(),
            'school_id' => $schoolId,
            'message' => 'Student created successfully',
        ];
    }

    public function parentSummary(?string $search = null): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        $conditions = [];
        $params = [];

        if ($role !== 'super_admin') {
            $conditions[] = 's.school_id = ?';
            $params[] = $schoolId;
        }

        if ($search !== null && trim($search) !== '') {
            $conditions[] = '(LOWER(s.parent_name) LIKE ? OR LOWER(COALESCE(s.phone, "")) LIKE ?)';
            $term = '%' . strtolower(trim($search)) . '%';
            $params[] = $term;
            $params[] = $term;
        }

        $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $sql = "
            SELECT
                s.parent_name,
                s.phone,
                COUNT(DISTINCT s.id) AS children_count,
                GROUP_CONCAT(DISTINCT CONCAT(s.first_name, ' ', s.last_name) ORDER BY s.last_name SEPARATOR ', ') AS children_names,
                COALESCE(SUM(CASE WHEN mf.status != 'PAID' THEN mf.remaining_amount ELSE 0 END), 0) AS total_remaining,
                SUM(CASE WHEN mf.status = 'UNPAID' THEN 1 ELSE 0 END) AS unpaid_months,
                SUM(CASE WHEN mf.status = 'PARTIAL' THEN 1 ELSE 0 END) AS partial_months
            FROM students s
            LEFT JOIN monthly_fees mf ON mf.student_id = s.id AND mf.school_id = s.school_id
            {$whereSql}
            GROUP BY s.parent_name, s.phone
            ORDER BY total_remaining DESC, children_count DESC, s.parent_name ASC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
}
