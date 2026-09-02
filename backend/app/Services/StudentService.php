<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use PDOException;

class StudentService
{
    private const STATUSES = ['PRE_REGISTERED', 'REGISTERED', 'WAITING_LIST', 'CANCELLED', 'ARCHIVED'];

    public function getAll(array $filters = []): array
    {
        $pdo = Database::connect(); [$role, $schoolId] = $this->authScope(); $where = []; $params = [];
        if ($role === 'super_admin' && !empty($filters['school_id'])) { $where[] = 's.school_id = ?'; $params[] = (int)$filters['school_id']; }
        elseif ($role !== 'super_admin') { $where[] = 's.school_id = ?'; $params[] = $schoolId; }
        foreach (['class_level_id' => 's.class_level_id', 'status' => 's.status', 'cycle_id' => 's.cycle_id', 'school_level_id' => 's.school_level_id'] as $key => $column) if (($filters[$key] ?? '') !== '') { $where[] = "$column = ?"; $params[] = $filters[$key]; }
        $search = trim((string)($filters['search'] ?? ''));
        if ($search !== '') { $term = '%' . strtolower($search) . '%'; $where[] = '(LOWER(s.first_name) LIKE ? OR LOWER(s.last_name) LIKE ? OR LOWER(s.internal_number) LIKE ? OR LOWER(s.massar_code) LIKE ?)'; array_push($params, $term, $term, $term, $term); }
        foreach (['last_name', 'first_name', 'class_name'] as $key) { $value = trim((string)($filters[$key] ?? '')); if ($value !== '') { $where[] = "LOWER(s.$key) LIKE ?"; $params[] = '%' . strtolower($value) . '%'; } }
        $sql = 'SELECT s.*, COALESCE(cl.level_name, cl.name, s.class_level) AS class_level_name, cl.group_name AS class_group_name, ay.label AS academic_year_label, sc.label AS cycle_label, sl.label AS school_level_label, COALESCE(SUM(mf.total_amount),0) AS financial_total, COALESCE(SUM(mf.amount_paid),0) AS financial_paid, COALESCE(SUM(mf.remaining_amount),0) AS financial_remaining FROM students s LEFT JOIN class_levels cl ON cl.id=s.class_level_id AND cl.school_id=s.school_id LEFT JOIN academic_years ay ON ay.id=s.academic_year_id AND ay.school_id=s.school_id LEFT JOIN school_cycles sc ON sc.id=s.cycle_id AND sc.school_id=s.school_id LEFT JOIN school_levels sl ON sl.id=s.school_level_id AND sl.school_id=s.school_id LEFT JOIN monthly_fees mf ON mf.student_id=s.id AND mf.school_id=s.school_id';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $stmt = $pdo->prepare($sql . ' GROUP BY s.id ORDER BY s.last_name, s.first_name, s.id DESC'); $stmt->execute($params); return $stmt->fetchAll();
    }

    public function getById(int $id): array|false
    {
        [$role, $schoolId] = $this->authScope(); $params = [$id];
        $sql = 'SELECT s.*, COALESCE(cl.level_name,cl.name,s.class_level) AS class_level_name, cl.group_name AS class_group_name, ay.label AS academic_year_label, sc.label AS cycle_label, sl.label AS school_level_label FROM students s LEFT JOIN class_levels cl ON cl.id=s.class_level_id AND cl.school_id=s.school_id LEFT JOIN academic_years ay ON ay.id=s.academic_year_id AND ay.school_id=s.school_id LEFT JOIN school_cycles sc ON sc.id=s.cycle_id AND sc.school_id=s.school_id LEFT JOIN school_levels sl ON sl.id=s.school_level_id AND sl.school_id=s.school_id WHERE s.id=?';
        if ($role !== 'super_admin') { $sql .= ' AND s.school_id=?'; $params[] = $schoolId; }
        $stmt = Database::connect()->prepare($sql); $stmt->execute($params); return $stmt->fetch() ?: false;
    }

    public function create(array $data): array
    {
        $pdo = Database::connect(); $schoolId = $this->writeSchoolId($data); if (!$schoolId) return ['error' => 'School is required to create student'];
        $student = $this->validate($pdo, $schoolId, $data); if (isset($student['error'])) return $student;
        $ownsTransaction = !$pdo->inTransaction();
        try { if ($ownsTransaction) $pdo->beginTransaction(); $parentId = $this->resolveOrCreateParent($pdo, $schoolId, $student);
            $stmt = $pdo->prepare('INSERT INTO students (school_id,parent_id,family_id,internal_number,massar_code,cne,photo_path,first_name,last_name,first_name_ar,last_name_ar,date_of_birth,birth_place,gender,nationality,address,entry_date,previous_school,registration_date,class_level,class_name,class_level_id,parent_name,phone,monthly_amount,discount_percent,school_year,academic_year_id,cycle_id,school_level_id,uses_transport,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute($this->studentValues($schoolId, $parentId, $student)); $id = (int)$pdo->lastInsertId(); $this->history($pdo, $schoolId, $id, null, $student['status'], 'Création du dossier'); if ($ownsTransaction) $pdo->commit(); return ['id'=>$id, 'school_id'=>$schoolId, 'message'=>'Student created successfully'];
        } catch (PDOException $e) { if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack(); return $this->duplicateError($e); }
    }

    public function update(int $id, array $data): array
    {
        $existing = $this->getById($id); if (!$existing) return ['error'=>'Student not found']; $pdo = Database::connect(); $schoolId = (int)$existing['school_id'];
        $student = $this->validate($pdo, $schoolId, array_merge($existing, $data)); if (isset($student['error'])) return $student; $ownsTransaction = !$pdo->inTransaction();
        try { if ($ownsTransaction) $pdo->beginTransaction(); $parentId = $this->resolveOrCreateParent($pdo, $schoolId, $student);
            $stmt = $pdo->prepare('UPDATE students SET parent_id=?,family_id=?,internal_number=?,massar_code=?,cne=?,photo_path=?,first_name=?,last_name=?,first_name_ar=?,last_name_ar=?,date_of_birth=?,birth_place=?,gender=?,nationality=?,address=?,entry_date=?,previous_school=?,registration_date=?,class_level=?,class_name=?,class_level_id=?,parent_name=?,phone=?,monthly_amount=?,discount_percent=?,school_year=?,academic_year_id=?,cycle_id=?,school_level_id=?,uses_transport=?,status=? WHERE id=? AND school_id=?');
            $stmt->execute(array_merge(array_slice($this->studentValues($schoolId, $parentId, $student), 1), [$id, $schoolId])); if ($existing['status'] !== $student['status']) $this->history($pdo, $schoolId, $id, (string)$existing['status'], $student['status'], $data['status_reason'] ?? null); if ($ownsTransaction) $pdo->commit(); return ['id'=>$id, 'message'=>'Student updated successfully'];
        } catch (PDOException $e) { if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack(); return $this->duplicateError($e); }
    }

    public function delete(int $id): array
    {
        $student = $this->getById($id); if (!$student) return ['error'=>'Student not found']; $pdo = Database::connect();
        $payments = $pdo->prepare('SELECT COUNT(*) FROM payments WHERE student_id=? AND school_id=?'); $payments->execute([$id, $student['school_id']]); if ((int)$payments->fetchColumn() > 0) return ['error'=>'Student with payments must be archived, not deleted'];
        $stmt = $pdo->prepare('DELETE FROM students WHERE id=? AND school_id=?'); $stmt->execute([$id, $student['school_id']]); return ['id'=>$id, 'message'=>'Student deleted successfully'];
    }

    public function parentSummary(?string $search = null): array
    {
        [$role, $schoolId] = $this->authScope(); $where = []; $params = [];
        if ($role !== 'super_admin') { $where[] = 's.school_id = ?'; $params[] = $schoolId; }
        if ($search !== null && trim($search) !== '') { $where[] = '(LOWER(COALESCE(s.parent_name,"")) LIKE ? OR LOWER(COALESCE(s.phone,"")) LIKE ?)'; $term = '%' . strtolower(trim($search)) . '%'; array_push($params, $term, $term); }
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
        $sql = "SELECT s.parent_name,s.phone,COUNT(DISTINCT s.id) AS children_count,GROUP_CONCAT(DISTINCT CONCAT(s.first_name,' ',s.last_name) ORDER BY s.last_name SEPARATOR ', ') AS children_names,COALESCE(SUM(CASE WHEN mf.status != 'PAID' THEN mf.remaining_amount ELSE 0 END),0) AS total_remaining,SUM(CASE WHEN mf.status='UNPAID' THEN 1 ELSE 0 END) AS unpaid_months,SUM(CASE WHEN mf.status='PARTIAL' THEN 1 ELSE 0 END) AS partial_months FROM students s LEFT JOIN monthly_fees mf ON mf.student_id=s.id AND mf.school_id=s.school_id{$whereSql} GROUP BY s.parent_name,s.phone ORDER BY total_remaining DESC,children_count DESC,s.parent_name ASC";
        $stmt = Database::connect()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll();
    }

    public function changeStatus(int $id, array $data): array
    {
        $student = $this->getById($id); if (!$student) return ['error'=>'Student not found']; $status = strtoupper(trim((string)($data['status'] ?? '')));
        if (!in_array($status, self::STATUSES, true)) return ['error'=>'Invalid student status']; if ($status === 'ARCHIVED') return $this->archive($id, $data); if ($status === 'REGISTERED' && $this->massarRequired((int)$student['school_id']) && empty($student['massar_code'])) return ['error'=>'Code Massar is required before registration'];
        $pdo = Database::connect(); $stmt = $pdo->prepare('UPDATE students SET status=?,archived_at=NULL,archived_by=NULL,archive_reason=NULL WHERE id=? AND school_id=?'); $stmt->execute([$status,$id,$student['school_id']]); $this->history($pdo,(int)$student['school_id'],$id,(string)$student['status'],$status,$data['reason']??null); return ['id'=>$id,'status'=>$status,'message'=>'Student status updated'];
    }
    public function archive(int $id, array $data): array
    {
        $student=$this->getById($id); if(!$student)return ['error'=>'Student not found']; $pdo=Database::connect(); $fees=$pdo->prepare('SELECT COALESCE(SUM(remaining_amount),0) FROM monthly_fees WHERE student_id=? AND school_id=?'); $fees->execute([$id,$student['school_id']]); $remaining=(float)$fees->fetchColumn(); if($remaining>0&&empty($data['confirm_outstanding_balance']))return ['error'=>'Outstanding balance requires explicit confirmation','remaining_amount'=>$remaining]; $user=Request::get('auth_user',[]); $stmt=$pdo->prepare('UPDATE students SET status="ARCHIVED",archived_at=NOW(),archived_by=?,archive_reason=? WHERE id=? AND school_id=?'); $stmt->execute([(int)($user['id']??0)?:null,$this->nullable($data['reason']??null),$id,$student['school_id']]); $this->history($pdo,(int)$student['school_id'],$id,(string)$student['status'],'ARCHIVED',$data['reason']??null); return ['id'=>$id,'status'=>'ARCHIVED','remaining_amount'=>$remaining,'message'=>'Student archived'];
    }
    public function statusHistory(int $id): array { $student=$this->getById($id); if(!$student)return []; $stmt=Database::connect()->prepare('SELECT h.*,u.first_name,u.last_name FROM student_status_histories h LEFT JOIN users u ON u.id=h.changed_by WHERE h.student_id=? AND h.school_id=? ORDER BY h.created_at DESC,h.id DESC'); $stmt->execute([$id,$student['school_id']]); return $stmt->fetchAll(); }
    public function matriculePreview(): array { $schoolId=$this->writeSchoolId([]); return $schoolId ? ['internal_number'=>$this->nextNumber(Database::connect(),$schoolId)] : ['error'=>'School is required']; }
    public function massarCheck(string $value, ?int $exceptId = null): array { $schoolId=$this->writeSchoolId([]); $code=$this->massar($value); if(!$schoolId||$code==='')return ['available'=>true,'massar_code'=>$code]; $sql='SELECT id FROM students WHERE school_id=? AND massar_code=?'; $params=[$schoolId,$code]; if($exceptId){$sql.=' AND id != ?';$params[]=$exceptId;} $stmt=Database::connect()->prepare($sql);$stmt->execute($params);return ['available'=>!$stmt->fetch(),'massar_code'=>$code]; }

    private function validate(PDO $pdo, int $schoolId, array $data): array
    {
        $first=trim((string)($data['first_name']??'')); $last=trim((string)($data['last_name']??'')); if($first===''||$last==='')return ['error'=>'first_name and last_name are required']; $status=strtoupper(trim((string)($data['status']??'PRE_REGISTERED'))); $status=['ACTIVE'=>'REGISTERED','INACTIVE'=>'ARCHIVED'][$status]??$status; if(!in_array($status,self::STATUSES,true))return ['error'=>'Invalid student status']; $massar=$this->massar((string)($data['massar_code']??'')); if($status==='REGISTERED'&&$this->massarRequired($schoolId)&&$massar==='')return ['error'=>'Code Massar is required before registration']; $class=$this->resolveClassLevel($pdo,$schoolId,$data); if(isset($class['error']))return $class; $parentName=trim((string)($data['parent_name']??''));
        return ['internal_number'=>trim((string)($data['internal_number']??''))?:$this->nextNumber($pdo,$schoolId),'massar_code'=>$this->nullable($massar),'cne'=>$this->nullable($data['cne']??null),'photo_path'=>$this->nullable($data['photo_path']??null),'first_name'=>$first,'last_name'=>$last,'first_name_ar'=>$this->nullable($data['first_name_ar']??null),'last_name_ar'=>$this->nullable($data['last_name_ar']??null),'date_of_birth'=>$this->date($data['date_of_birth']??null),'birth_place'=>$this->nullable($data['birth_place']??null),'gender'=>$this->nullable($data['gender']??null),'nationality'=>$this->nullable($data['nationality']??null),'address'=>$this->nullable($data['address']??null),'entry_date'=>$this->date($data['entry_date']??null),'previous_school'=>$this->nullable($data['previous_school']??null),'registration_date'=>$this->date($data['registration_date']??null),'class_level'=>$class['name'],'class_name'=>$this->nullable($data['class_name']??null),'class_level_id'=>$class['id'],'parent_name'=>$parentName!==''?$parentName:'Parent '.$last,'parent_phone'=>$this->nullable($data['parent_phone']??($data['phone']??null)),'family_id'=>$this->foreignId($pdo,'families',$schoolId,$data['family_id']??null),'monthly_amount'=>max(0,(float)($data['monthly_amount']??0)),'discount_percent'=>min(100,max(0,(float)($data['discount_percent']??0))),'school_year'=>$this->nullable($data['school_year']??null),'academic_year_id'=>$this->foreignId($pdo,'academic_years',$schoolId,$data['academic_year_id']??null),'cycle_id'=>$this->foreignId($pdo,'school_cycles',$schoolId,$data['cycle_id']??null),'school_level_id'=>$this->foreignId($pdo,'school_levels',$schoolId,$data['school_level_id']??null),'uses_transport'=>$this->boolean($data['uses_transport']??false),'status'=>$status];
    }
    private function studentValues(int $schoolId, ?int $parentId, array $s): array { return [$schoolId,$parentId,$s['family_id'],$s['internal_number'],$s['massar_code'],$s['cne'],$s['photo_path'],$s['first_name'],$s['last_name'],$s['first_name_ar'],$s['last_name_ar'],$s['date_of_birth'],$s['birth_place'],$s['gender'],$s['nationality'],$s['address'],$s['entry_date'],$s['previous_school'],$s['registration_date'],$s['class_level'],$s['class_name'],$s['class_level_id'],$s['parent_name'],$s['parent_phone'],$s['monthly_amount'],$s['discount_percent'],$s['school_year'],$s['academic_year_id'],$s['cycle_id'],$s['school_level_id'],$s['uses_transport'],$s['status']]; }
    private function resolveClassLevel(PDO $pdo,int $schoolId,array $data):array { $id=(int)($data['class_level_id']??0);if($id>0){$stmt=$pdo->prepare('SELECT id,name FROM class_levels WHERE id=? AND school_id=? LIMIT 1');$stmt->execute([$id,$schoolId]);$row=$stmt->fetch();return $row?['id'=>(int)$row['id'],'name'=>(string)$row['name']]:['error'=>'Invalid class_level_id'];}$name=trim((string)($data['class_level']??''));if($name==='')return ['error'=>'class_level_id or class_level is required'];$stmt=$pdo->prepare('SELECT id,name FROM class_levels WHERE school_id=? AND name=? LIMIT 1');$stmt->execute([$schoolId,$name]);$row=$stmt->fetch();if($row)return ['id'=>(int)$row['id'],'name'=>(string)$row['name']];$stmt=$pdo->prepare('INSERT INTO class_levels (school_id,name,status) VALUES (?,?,"ACTIVE")');$stmt->execute([$schoolId,$name]);return ['id'=>(int)$pdo->lastInsertId(),'name'=>$name]; }
    private function resolveOrCreateParent(PDO $pdo,int $schoolId,array $student):?int { if(!$student['parent_phone'])return null;$stmt=$pdo->prepare('SELECT id FROM parents WHERE school_id=? AND phone=? LIMIT 1');$stmt->execute([$schoolId,$student['parent_phone']]);$row=$stmt->fetch();if($row)return(int)$row['id'];$parts=preg_split('/\s+/',$student['parent_name']);$stmt=$pdo->prepare('INSERT INTO parents (school_id,first_name,last_name,phone,email) VALUES (?,?,?,?,NULL)');$stmt->execute([$schoolId,$parts[0]??'Parent',implode(' ',array_slice($parts,1))?:$student['last_name'],$student['parent_phone']]);return(int)$pdo->lastInsertId(); }
    private function foreignId(PDO $pdo,string $table,int $schoolId,mixed $value):?int { $id=(int)$value;if($id<=0)return null;$stmt=$pdo->prepare("SELECT id FROM $table WHERE id=? AND school_id=?");$stmt->execute([$id,$schoolId]);return $stmt->fetch()?$id:null; }
    private function history(PDO $pdo,int $schoolId,int $studentId,?string $previous,string $next,?string $reason):void { $user=Request::get('auth_user',[]);$stmt=$pdo->prepare('INSERT INTO student_status_histories (school_id,student_id,previous_status,new_status,reason,changed_by) VALUES (?,?,?,?,?,?)');$stmt->execute([$schoolId,$studentId,$previous,$next,$this->nullable($reason),(int)($user['id']??0)?:null]); }
    private function nextNumber(PDO $pdo,int $schoolId):string { $prefix=$this->setting($pdo,$schoolId,'student_internal_number_prefix')?:('ELV-'.$schoolId.'-');$stmt=$pdo->prepare('SELECT internal_number FROM students WHERE school_id=? AND internal_number LIKE ? ORDER BY id DESC LIMIT 1');$stmt->execute([$schoolId,$prefix.'%']);preg_match('/(\d+)$/',(string)$stmt->fetchColumn(),$match);return $prefix.str_pad((string)(((int)($match[1]??0))+1),5,'0',STR_PAD_LEFT); }
    private function massarRequired(int $schoolId):bool { return $this->setting(Database::connect(),$schoolId,'massar_required_on_registration')==='1'; }
    private function setting(PDO $pdo,int $schoolId,string $key):?string { $stmt=$pdo->prepare('SELECT setting_value FROM school_settings WHERE school_id=? AND setting_key=?');$stmt->execute([$schoolId,$key]);$value=$stmt->fetchColumn();return $value===false?null:(string)$value; }
    private function writeSchoolId(array $data):?int { [$role,$schoolId]=$this->authScope();if($role==='super_admin')$schoolId=(int)($data['school_id']??$_GET['school_id']??0);return $schoolId?:null; }
    private function authScope():array { $user=Request::get('auth_user',[]);return [(string)($user['role']??''),isset($user['school_id'])?(int)$user['school_id']:null]; }
    private function massar(string $value):string { return strtoupper(preg_replace('/\s+/u','',trim($value))??''); }
    private function nullable(mixed $value):?string { $value=trim((string)$value);return $value===''?null:$value; }
    private function boolean(mixed $value): int { return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0; }
    private function date(mixed $value):?string { $value=$this->nullable($value);return $value&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$value)?$value:null; }
    private function duplicateError(PDOException $e):array { return (int)$e->getCode()===23000?['error'=>'Matricule interne ou Code Massar déjà utilisé dans cet établissement']:['error'=>'Student operation failed']; }
}
