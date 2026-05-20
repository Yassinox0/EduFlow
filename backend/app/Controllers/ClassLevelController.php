<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\ClassLevelService;

class ClassLevelController
{
    public function index(): void
    {
        $schoolId = isset($_GET['school_id']) ? (int)$_GET['school_id'] : null;
        Response::json((new ClassLevelService())->getAll($schoolId));
    }

    public function store(): void
    {
        $result = (new ClassLevelService())->create(Request::json());
        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 422);
        }

        Response::json($result, 201);
    }
}
