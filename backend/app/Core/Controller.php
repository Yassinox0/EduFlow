<?php

declare(strict_types=1);

namespace App\Core;

class Controller
{
    protected function ok($data): void
    {
        Response::json($data, 200);
    }

    protected function created($data): void
    {
        Response::json($data, 201);
    }
}
