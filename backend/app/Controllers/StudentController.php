<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\StudentService;

class StudentController
{
    public function index(): void
    {
        Response::json((new StudentService())->getAll());
    }

    public function store(): void
    {
        $result = (new StudentService())->create(Request::json());
        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 422);
        }

        Response::json($result, 201);
    }

    public function parentSummary(): void
    {
        $search = isset($_GET['search']) ? (string)$_GET['search'] : null;
        Response::json((new StudentService())->parentSummary($search));
    }
}
