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

    public function update(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new StudentService())->update($id, Request::json());
        if (isset($result['error'])) {
            $status = $result['error'] === 'Student not found' ? 404 : 422;
            if ($result['error'] === 'Forbidden') {
                $status = 403;
            }
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result);
    }

    public function parentSummary(): void
    {
        $search = isset($_GET['search']) ? (string)$_GET['search'] : null;
        Response::json((new StudentService())->parentSummary($search));
    }

    public function delete(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new StudentService())->delete($id);
        if (isset($result['error'])) {
            $status = $result['error'] === 'Student not found' ? 404 : 422;
            if ($result['error'] === 'Forbidden') {
                $status = 403;
            }
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result);
    }
}
