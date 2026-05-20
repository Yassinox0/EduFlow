<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Services\PaymentMethodService;

class PaymentMethodController
{
    public function index(): void
    {
        Response::json((new PaymentMethodService())->getAll());
    }
}
