<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;

class PaymentService
{
    public function getAll(): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            $stmt = $pdo->query('SELECT * FROM payments ORDER BY id DESC');
            return $stmt->fetchAll();
        }

        $stmt = $pdo->prepare('SELECT * FROM payments WHERE school_id = ? ORDER BY id DESC');
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
            return ['error' => 'School is required to create payment'];
        }

        $studentId = (int)($data['student_id'] ?? 0);
        $monthlyFeeId = (int)($data['monthly_fee_id'] ?? 0);
        if ($studentId <= 0 || $monthlyFeeId <= 0) {
            return ['error' => 'student_id and monthly_fee_id are required'];
        }

        $check = $pdo->prepare('
            SELECT id
            FROM monthly_fees
            WHERE id = ? AND student_id = ? AND school_id = ?
            LIMIT 1
        ');
        $check->execute([$monthlyFeeId, $studentId, $schoolId]);
        $fee = $check->fetch();
        if (!$fee) {
            return ['error' => 'Monthly fee not found for this school/student'];
        }

        $stmt = $pdo->prepare('INSERT INTO payments (school_id, student_id, monthly_fee_id, amount_paid, payment_date, payment_method) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $schoolId,
            $studentId,
            $monthlyFeeId,
            $data['amount_paid'] ?? 0,
            $data['payment_date'] ?? date('Y-m-d'),
            $data['payment_method'] ?? 'cash',
        ]);

        return [
            'id' => (int)$pdo->lastInsertId(),
            'school_id' => $schoolId,
            'message' => 'Payment created successfully',
        ];
    }
}
