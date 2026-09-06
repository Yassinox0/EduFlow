<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\TeacherAssignmentService;

class TeacherAssignmentController
{
    public function index(): void
    {
        Response::json((new TeacherAssignmentService())->getAll($_GET));
    }

    public function store(): void
    {
        $result = (new TeacherAssignmentService())->create(Request::json());
        $this->respond($result, 201);
    }

    public function update(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new TeacherAssignmentService())->update($id, Request::json());
        $this->respond($result);
    }

    public function delete(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new TeacherAssignmentService())->deactivate($id);
        $this->respond($result);
    }

    private function respond(array $result, int $successStatus = 200): void
    {
        if (isset($result['error'])) {
            $status = $result['error'] === 'Teacher assignment not found' ? 404 : 422;
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result, $successStatus);
    }
}
