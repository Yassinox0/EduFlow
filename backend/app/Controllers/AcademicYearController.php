<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\AcademicYearService;

class AcademicYearController
{
    public function index(): void
    {
        Response::json((new AcademicYearService())->getAll());
    }

    public function store(): void
    {
        $result = (new AcademicYearService())->create(Request::json());
        $this->respond($result, 201);
    }

    public function update(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new AcademicYearService())->update($id, Request::json());
        $this->respond($result);
    }

    private function respond(array $result, int $successStatus = 200): void
    {
        if (isset($result['error'])) {
            $status = $result['error'] === 'Academic year not found' ? 404 : 422;
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result, $successStatus);
    }
}
