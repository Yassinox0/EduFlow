<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Services\SuperAdminService;

class SuperAdminController
{
    public function dashboard(): void
    {
        Response::json((new SuperAdminService())->dashboard());
    }
}
