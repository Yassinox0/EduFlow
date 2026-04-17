<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\UserService;

class UserController
{
    public function index(): void
    {
        Response::json((new UserService())->getAll());
    }

    public function store(): void
    {
        $result = (new UserService())->create(Request::json());
        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 422);
        }

        Response::json($result, 201);
    }

    public function update(): void
    {
        $userId = (int)Request::param('id', 0);
        $result = (new UserService())->update($userId, Request::json());
        if (isset($result['error'])) {
            $status = in_array($result['error'], ['User not found'], true) ? 404 : 422;
            if ($result['error'] === 'Forbidden') {
                $status = 403;
            }
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result);
    }
}
