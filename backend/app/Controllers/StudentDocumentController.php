<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\Request;use App\Core\Response;use App\Services\StudentDocumentService;
class StudentDocumentController { public function generate():void{$r=(new StudentDocumentService())->generate(Request::json());if(isset($r['error']))Response::json(['message'=>$r['error']],422);Response::pdf($r['content'],$r['filename']);} public function financialStatement():void{$r=(new StudentDocumentService())->generate(['student_ids'=>[(int)Request::param('id',0)]]);if(isset($r['error']))Response::json(['message'=>$r['error']],422);Response::pdf($r['content'],$r['filename']);} }
