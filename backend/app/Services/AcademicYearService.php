<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\Database;use App\Core\Request;
class AcademicYearService { public function all():array{$u=Request::get('auth_user',[]);$school=(int)($u['school_id']??0);$s=Database::connect()->prepare('SELECT id,label,starts_on,ends_on,status FROM academic_years WHERE school_id=? AND status="ACTIVE" ORDER BY label DESC');$s->execute([$school]);return $s->fetchAll();} }
