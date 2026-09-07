<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use DomainException;
use PDO;

/**
 * Read-only financial projection shared by future documents.
 *
 * There is no reliable FK between monthly_fees and student_financial_items.
 * Therefore both sources coexist as distinct obligations; this service never
 * attempts heuristic matching by amount, label, date, or period.
 */
class FinancialDataService
{
    public function getStudentFinancialItems(int $schoolId, int $studentId, ?int $academicYearId = null): array
    {
        $pdo = Database::connect();
        $year = $this->year($pdo, $schoolId, $academicYearId);
        $this->student($pdo, $schoolId, $studentId);
        $items = array_merge($this->flexibleItems($pdo, $schoolId, $studentId, $year), $this->legacyItems($pdo, $schoolId, $studentId, $year));
        foreach ($items as &$item) $item['student_id'] = $studentId;
        unset($item);
        usort($items, static fn(array $a, array $b): int => strcmp((string)$a['due_date'], (string)$b['due_date']) ?: strcmp($a['label'], $b['label']));
        return $items;
    }

    public function getStudentFinancialSummary(int $schoolId, int $studentId, ?int $academicYearId = null): array
    {
        $items = $this->getStudentFinancialItems($schoolId, $studentId, $academicYearId);
        return $this->summary($items);
    }

    public function getStudentUnpaidItems(int $schoolId, int $studentId, ?int $academicYearId = null): array
    {
        $items = $this->getStudentFinancialItems($schoolId, $studentId, $academicYearId);
        // A flexible item without an échéance is actionable; future dated items are not overdue.
        $today = date('Y-m-d');
        $items = array_values(array_filter($items, static fn(array $item): bool => (float)$item['remaining_amount'] > 0 && (!$item['due_date'] || $item['due_date'] <= $today)));
        return ['items' => $items, 'total_remaining' => round(array_sum(array_column($items, 'remaining_amount')), 2)];
    }

    public function getStudentPayments(int $schoolId, int $studentId, ?int $academicYearId = null): array
    {
        $pdo = Database::connect(); $year = $this->year($pdo, $schoolId, $academicYearId); $this->student($pdo, $schoolId, $studentId);
        $legacyYearSql = $year ? ' AND mf.year_value=?' : ''; $legacyParams = [$schoolId, $studentId]; if ($year) $legacyParams[] = $year['legacy_year'];
        $legacy = $pdo->prepare('SELECT p.id,p.amount_paid,p.payment_date,p.payment_method,p.status,mf.month_label,mf.year_value FROM payments p INNER JOIN monthly_fees mf ON mf.id=p.monthly_fee_id AND mf.school_id=p.school_id WHERE p.school_id=? AND p.student_id=?' . $legacyYearSql . ' ORDER BY p.payment_date,p.id');
        $legacy->execute($legacyParams); $result = [];
        foreach ($legacy->fetchAll() as $row) $result[] = ['payment_id'=>(int)$row['id'],'date'=>$row['payment_date'],'method'=>$row['payment_method'],'amount'=>(float)$row['amount_paid'],'status'=>$row['status'] ?: 'COMPLETED','source'=>'LEGACY','period'=>str_pad((string)$row['month_label'],2,'0',STR_PAD_LEFT).'/'.$row['year_value'],'allocations'=>[]];
        $flexSql = 'SELECT DISTINCT p.id,p.amount_paid,p.payment_date,p.payment_method,p.status FROM payments p INNER JOIN payment_allocations pa ON pa.payment_id=p.id AND pa.school_id=p.school_id INNER JOIN student_financial_items fi ON fi.id=pa.student_financial_item_id AND fi.school_id=pa.school_id WHERE p.school_id=? AND p.student_id=?';
        $flexParams = [$schoolId,$studentId]; if ($year) {$flexSql .= ' AND fi.academic_year_id=?'; $flexParams[]=$year['id'];} $flexSql .= ' ORDER BY p.payment_date,p.id';
        $flex = $pdo->prepare($flexSql); $flex->execute($flexParams);
        $alloc = $pdo->prepare('SELECT pa.student_financial_item_id,pa.amount,COALESCE(cc.code,"FLEXIBLE") category_code,COALESCE(cc.label,fi.label) category_name,fi.label FROM payment_allocations pa INNER JOIN student_financial_items fi ON fi.id=pa.student_financial_item_id AND fi.school_id=pa.school_id LEFT JOIN student_financial_item_details d ON d.student_financial_item_id=fi.id AND d.school_id=fi.school_id LEFT JOIN charge_categories cc ON cc.id=d.charge_category_id AND cc.school_id=fi.school_id WHERE pa.payment_id=? AND pa.school_id=? ORDER BY pa.id');
        foreach ($flex->fetchAll() as $row) { $alloc->execute([(int)$row['id'],$schoolId]); $result[]=['payment_id'=>(int)$row['id'],'date'=>$row['payment_date'],'method'=>$row['payment_method'],'amount'=>(float)$row['amount_paid'],'status'=>$row['status'] ?: 'COMPLETED','source'=>'FLEXIBLE','period'=>null,'allocations'=>array_map(static fn(array $a)=>['student_financial_item_id'=>(int)$a['student_financial_item_id'],'category'=>$a['category_name'],'category_code'=>$a['category_code'],'label'=>$a['label'],'amount'=>(float)$a['amount']],$alloc->fetchAll())]; }
        usort($result, static fn(array $a,array $b)=>strcmp($a['date'],$b['date']) ?: $a['payment_id']<=>$b['payment_id']); return $result;
    }

    public function getFamilyFinancialSummary(int $schoolId, int $familyId, ?int $academicYearId = null): array
    {
        $pdo=Database::connect(); $year=$this->year($pdo,$schoolId,$academicYearId); $check=$pdo->prepare('SELECT id FROM families WHERE id=? AND school_id=?');$check->execute([$familyId,$schoolId]);if(!$check->fetch())throw new DomainException('Family not found for this school');
        $students=$pdo->prepare('SELECT s.id,s.first_name,s.last_name,COALESCE(cl.level_name,cl.name,s.class_level) class_level_name,s.class_name FROM students s LEFT JOIN class_levels cl ON cl.id=s.class_level_id AND cl.school_id=s.school_id WHERE s.family_id=? AND s.school_id=? ORDER BY s.last_name,s.first_name');$students->execute([$familyId,$schoolId]);$children=[];$all=[];
        foreach($students->fetchAll() as $student){$summary=$this->getStudentFinancialSummary($schoolId,(int)$student['id'],$year['id']);$children[]=['student_id'=>(int)$student['id'],'name'=>trim($student['first_name'].' '.$student['last_name']),'class'=>trim(($student['class_level_name']??'').' '.($student['class_name']??'')),'summary'=>$summary];$all=array_merge($all,$summary['items']);}
        return ['academic_year_id'=>$year['id'],'children'=>$children,'summary'=>$this->summary($all)];
    }

    private function flexibleItems(PDO $pdo,int $schoolId,int $studentId,?array $year):array { $sql='SELECT fi.id,fi.student_id,fi.academic_year_id,fi.label,fi.status,d.charge_category_id,d.due_date,d.original_amount,d.discount_type,d.discount_value,d.final_amount,cc.code,cc.label category_name,COALESCE(SUM(CASE WHEN p.status="COMPLETED" THEN pa.amount ELSE 0 END),0) paid FROM student_financial_items fi INNER JOIN student_financial_item_details d ON d.student_financial_item_id=fi.id AND d.school_id=fi.school_id LEFT JOIN charge_categories cc ON cc.id=d.charge_category_id AND cc.school_id=fi.school_id LEFT JOIN payment_allocations pa ON pa.student_financial_item_id=fi.id AND pa.school_id=fi.school_id LEFT JOIN payments p ON p.id=pa.payment_id AND p.school_id=pa.school_id WHERE fi.school_id=? AND fi.student_id=?';$params=[$schoolId,$studentId];if($year){$sql.=' AND fi.academic_year_id=?';$params[]=$year['id'];}$sql.=' GROUP BY fi.id,fi.student_id,d.charge_category_id,d.due_date,d.original_amount,d.discount_type,d.discount_value,d.final_amount,cc.code,cc.label';$q=$pdo->prepare($sql);$q->execute($params);return array_map(static function(array$r):array{$final=round((float)$r['final_amount'],2);$paid=min($final,round((float)$r['paid'],2));return ['source_type'=>'FLEXIBLE_ITEM','source_id'=>(int)$r['id'],'student_id'=>(int)$r['student_id'],'academic_year_id'=>$r['academic_year_id']?(int)$r['academic_year_id']:null,'category_code'=>$r['code']??'FLEXIBLE','category_name'=>$r['category_name']??$r['label'],'label'=>$r['label'],'period'=>null,'due_date'=>$r['due_date'],'initial_amount'=>(float)$r['original_amount'],'discount_type'=>$r['discount_type'],'discount_value'=>$r['discount_value']===null?null:(float)$r['discount_value'],'discount_amount'=>round((float)$r['original_amount']-$final,2),'final_amount'=>$final,'paid_amount'=>$paid,'remaining_amount'=>max(0,round($final-$paid,2)),'status'=>$paid<=0?'UNPAID':($paid>=$final?'PAID':'PARTIAL')];},$q->fetchAll()); }

    private function legacyItems(PDO $pdo,int $schoolId,int $studentId,?array $year):array { $sql='SELECT mf.id,mf.month_label,mf.year_value,mf.total_amount,mf.amount_paid,mf.remaining_amount,mf.status FROM monthly_fees mf WHERE mf.school_id=? AND mf.student_id=?';$params=[$schoolId,$studentId];if($year){$sql.=' AND mf.year_value=?';$params[]=$year['legacy_year'];}$q=$pdo->prepare($sql);$q->execute($params);return array_map(static fn(array$r)=>['source_type'=>'LEGACY_MONTHLY_FEE','source_id'=>(int)$r['id'],'student_id'=>$studentId,'academic_year_id'=>$year['id']??null,'category_code'=>'TUITION','category_name'=>'Mensualité','label'=>'Mensualité '.str_pad((string)$r['month_label'],2,'0',STR_PAD_LEFT).'/'.$r['year_value'],'period'=>str_pad((string)$r['month_label'],2,'0',STR_PAD_LEFT).'/'.$r['year_value'],'due_date'=>null,'initial_amount'=>(float)$r['total_amount'],'discount_type'=>null,'discount_value'=>null,'discount_amount'=>0.0,'final_amount'=>(float)$r['total_amount'],'paid_amount'=>(float)$r['amount_paid'],'remaining_amount'=>(float)$r['remaining_amount'],'status'=>$r['status']],$q->fetchAll()); }

    private function summary(array $items):array { $sum=['total_initial'=>0.0,'total_discount'=>0.0,'total_final'=>0.0,'total_paid'=>0.0,'total_remaining'=>0.0];foreach($items as $i){$sum['total_initial']+=(float)$i['initial_amount'];$sum['total_discount']+=(float)$i['discount_amount'];$sum['total_final']+=(float)$i['final_amount'];$sum['total_paid']+=(float)$i['paid_amount'];$sum['total_remaining']+=(float)$i['remaining_amount'];}foreach($sum as $k=>$v)$sum[$k]=round($v,2);$sum['items']=$items;return $sum; }
    private function student(PDO $pdo,int $schoolId,int $studentId):void{$q=$pdo->prepare('SELECT id FROM students WHERE id=? AND school_id=?');$q->execute([$studentId,$schoolId]);if(!$q->fetch())throw new DomainException('Student not found for this school');}
    private function year(PDO $pdo,int $schoolId,?int $id):?array {if(!$id){$q=$pdo->prepare('SELECT ay.id,ay.name FROM school_settings s INNER JOIN academic_years ay ON ay.id=CAST(s.setting_value AS UNSIGNED) AND ay.school_id=s.school_id WHERE s.school_id=? AND s.setting_key="active_academic_year_id"');$q->execute([$schoolId]);$r=$q->fetch();if(!$r)return null;}else{$q=$pdo->prepare('SELECT id,name FROM academic_years WHERE id=? AND school_id=?');$q->execute([$id,$schoolId]);$r=$q->fetch();if(!$r)throw new DomainException('Academic year not found for this school');}if(!preg_match('/^(\d{4})[-\/]/',(string)$r['name'],$m))throw new DomainException('Academic year cannot be mapped safely to legacy monthly fees');return ['id'=>(int)$r['id'],'name'=>$r['name'],'legacy_year'=>(int)$m[1]];}
}
