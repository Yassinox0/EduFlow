<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\AuthService;

class AuthController
{
    public function login(): void
    {
        $data = Request::json();
        $result = (new AuthService())->login($data['email'] ?? '', $data['password'] ?? '');

        if (!$result) {
            Response::json(['message' => 'Invalid credentials'], 401);
        }

        Response::json($result);
    }
}
