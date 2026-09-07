<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\Request;
use App\Core\Response;
use App\Services\PaymentDocumentService;
class PaymentDocumentController {
    private function send(array $result): void { if(isset($result['error'])) Response::json(['message'=>$result['error']],(int)($result['status']??422)); Response::pdf($result['content'],$result['filename']); }
    public function monthly():void{$this->send((new PaymentDocumentService())->monthly($_GET));}
    public function student():void{$this->send((new PaymentDocumentService())->student((int)Request::param('id',0),$_GET));}
    public function family():void{$this->send((new PaymentDocumentService())->family((int)Request::param('id',0),$_GET));}
    public function unpaid():void{$this->send((new PaymentDocumentService())->unpaid($_GET));}
}
