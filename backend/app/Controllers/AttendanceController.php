<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\AttendanceService;

class AttendanceController
{
    public function sessions(): void
    {
        Response::json((new AttendanceService())->sessions($_GET));
    }

    public function roster(): void
    {
        $result = (new AttendanceService())->roster(
            (int)Request::param('scheduleId', 0),
            (string)Request::query('date', '')
        );
        $this->respond($result);
    }

    public function save(): void
    {
        $result = (new AttendanceService())->save((int)Request::param('scheduleId', 0), Request::json());
        $this->respond($result);
    }

    private function respond(array $result): void
    {
        if (isset($result['error'])) Response::json(['message' => $result['error']], 422);
        Response::json($result);
    }
}
