<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\Request;use App\Core\Response;use App\Services\LevelFeeService;
class LevelFeeController {public function show():void{$r=(new LevelFeeService())->show((int)Request::param('id',0));if(!$r)Response::json(['message'=>'No price configured for this level'],404);Response::json($r);}}
