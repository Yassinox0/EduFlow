<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Services\MonthlyFeeService;

class MonthlyFeeController
{
    public function index(): void
    {
        $filters = [
            'month_label' => isset($_GET['month_label']) ? (string)$_GET['month_label'] : null,
            'year_value' => isset($_GET['year_value']) ? (int)$_GET['year_value'] : null,
            'status' => isset($_GET['status']) ? (string)$_GET['status'] : null,
        ];

        Response::json((new MonthlyFeeService())->getAll($filters));
    }

    public function unpaid(): void
    {
        Response::json((new MonthlyFeeService())->getUnpaid());
    }
}
