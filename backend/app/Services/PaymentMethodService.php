<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

class PaymentMethodService
{
    public function getAll(): array
    {
        $pdo = Database::connect();
        $stmt = $pdo->query('SELECT id, code, label, status FROM payment_methods WHERE status = "ACTIVE" ORDER BY id ASC');
        return $stmt->fetchAll();
    }
}
