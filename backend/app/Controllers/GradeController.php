<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\GradeService;

class GradeController
{
    public function dashboard(): void { Response::json((new GradeService())->dashboard()); }
    public function index(): void { Response::json((new GradeService())->catalog($_GET)); }

    public function store(): void
    {
        $this->respond((new GradeService())->createAssessment(Request::json()), 201);
    }

    public function roster(): void
    {
        $this->respond((new GradeService())->roster((int)Request::param('id', 0)));
    }

    public function saveGrades(): void
    {
        $this->respond((new GradeService())->saveGrades((int)Request::param('id', 0), Request::json()));
    }

    public function updateStatus(): void
    {
        $this->respond((new GradeService())->updateStatus(
            (int)Request::param('id', 0),
            (string)(Request::json()['status'] ?? '')
        ));
    }

    public function gradebook(): void
    {
        $this->respond((new GradeService())->gradebook($_GET));
    }

    private function respond(array $result, int $status = 200): void
    {
        if (isset($result['error'])) Response::json(['message' => $result['error']], 422);
        Response::json($result, $status);
    }
}
