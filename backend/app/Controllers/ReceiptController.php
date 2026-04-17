<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Services\ReceiptService;

class ReceiptController
{
    public function show(int $paymentId): void
    {
        Response::json((new ReceiptService())->generateData($paymentId));
    }
}
