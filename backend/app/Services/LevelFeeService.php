<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\Database;use App\Core\Request;
class LevelFeeService { public function show(int $classLevelId):array|false{$u=Request::get('auth_user',[]);$school=(int)($u['school_id']??0);$s=Database::connect()->prepare('SELECT p.* FROM level_fee_prices p WHERE p.class_level_id=? AND p.school_id=? ORDER BY p.updated_at DESC LIMIT 1');$s->execute([$classLevelId,$school]);return $s->fetch()?:false;} }
