<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\Response;use App\Services\AcademicYearService;
class AcademicYearController {public function index():void{Response::json((new AcademicYearService())->all());}}
