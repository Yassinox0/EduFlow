<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\ReceiptService;

class ReceiptController
{
    public function show(): void
    {
        $id = (int)Request::param('id', 0);
        $language = Request::query('lang', 'fr') === 'ar' ? 'ar' : 'fr';
        $result = (new ReceiptService())->generateData($id, $language);

        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 404);
        }

        Response::json($result);
    }

    public function downloadPdf(): void
    {
        $id = (int)Request::param('id', 0);
        $language = Request::query('lang', 'fr') === 'ar' ? 'ar' : 'fr';
        $result = (new ReceiptService())->generatePdf($id, $language);

        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 404);
        }

        Response::pdf($result['content'], $result['filename']);
    }
}
