<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Services\DashboardService;

class DashboardController
{
    public function index(): void
    {
        Response::json((new DashboardService())->stats());
    }
}
