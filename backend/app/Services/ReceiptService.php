<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;

class ReceiptService
{
    public function generateData(int $paymentId): array
    {
        $pdo = Database::connect();
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            $stmt = $pdo->prepare('
                SELECT p.*, s.first_name, s.last_name, pm.label AS payment_method_label
                FROM payments p
                INNER JOIN students s ON s.id = p.student_id
                LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
                WHERE p.id = ?
            ');
            $stmt->execute([$paymentId]);
        } else {
            $stmt = $pdo->prepare('
                SELECT p.*, s.first_name, s.last_name, pm.label AS payment_method_label
                FROM payments p
                INNER JOIN students s ON s.id = p.student_id
                LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
                WHERE p.id = ? AND p.school_id = ?
            ');
            $stmt->execute([$paymentId, $schoolId]);
        }
        $payment = $stmt->fetch();

        if (!$payment) {
            return ['message' => 'Payment not found'];
        }

        return [
            'payment_id' => (int)$payment['id'],
            'student' => trim(($payment['first_name'] ?? '') . ' ' . ($payment['last_name'] ?? '')),
            'amount_paid' => (float)$payment['amount_paid'],
            'payment_date' => $payment['payment_date'],
            'payment_method' => $payment['payment_method_label'] ?: $payment['payment_method'],
        ];
    }
}
