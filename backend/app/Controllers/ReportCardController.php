<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\ReportCardService;

class ReportCardController
{
    public function download(): void
    {
        $result = (new ReportCardService())->generate(
            (int)Request::param('studentId', 0),
            (int)Request::query('period_id', 0),
            (string)Request::query('lang', 'fr')
        );
        if (isset($result['error'])) Response::json(['message' => $result['error']], 404);
        Response::pdf($result['content'], $result['filename']);
    }
}
