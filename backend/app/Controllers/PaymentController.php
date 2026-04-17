<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\PaymentService;

class PaymentController
{
    public function index(): void
    {
        Response::json((new PaymentService())->getAll());
    }

    public function store(): void
    {
        $result = (new PaymentService())->create(Request::json());
        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 422);
        }

        Response::json($result, 201);
    }
}
