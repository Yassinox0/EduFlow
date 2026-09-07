<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use Dompdf\Dompdf;
use Dompdf\Options;

class ReportCardService
{
    public function generate(int $studentId, int $periodId, string $language): array
    {
        $language = $language === 'ar' ? 'ar' : 'fr';
        $context = $this->context($studentId, $periodId);
        if (!$context) return ['error' => 'Student report card not found or forbidden'];
        $rows = $this->results($context, $periodId);
        $averages = array_values(array_filter(array_map(
            static fn(array $row): ?float => $row['average'] === null ? null : (float)$row['average'],
            $rows
        ), static fn(?float $value): bool => $value !== null));
        $overall = $averages ? round(array_sum($averages) / count($averages), 2) : null;
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');
        $pdf = new Dompdf($options);
        $pdf->loadHtml($this->html($context, $rows, $overall, $language), 'UTF-8');
        $pdf->setPaper('A4', 'portrait');
        $pdf->render();
        $name = preg_replace('/[^A-Za-z0-9-]+/', '-', strtolower($context['first_name'] . '-' . $context['last_name'])) ?: (string)$studentId;
        return ['content' => $pdf->output(), 'filename' => 'releve-' . $name . '.pdf'];
    }

    private function context(int $studentId, int $periodId): array|false
    {
        $user = Request::get('auth_user', []);
        $schoolId = (int)($user['school_id'] ?? 0);
        $stmt = Database::connect()->prepare('
            SELECT s.id, s.first_name, s.last_name, e.id AS enrollment_id, e.academic_year_id,
                   e.class_level_id, ay.name AS academic_year_name, cl.name AS class_name,
                   gp.name AS period_name, gp.code AS period_code,
                   sch.name AS school_name, sch.address AS school_address, sch.city AS school_city,
                   sch.phone AS school_phone, sch.logo_path AS school_logo_path,
                   sch.primary_color, sch.secondary_color
            FROM students s
            INNER JOIN enrollments e ON e.student_id = s.id AND e.status = "ACTIVE"
            INNER JOIN academic_years ay ON ay.id = e.academic_year_id
            INNER JOIN class_levels cl ON cl.id = e.class_level_id
            INNER JOIN grading_periods gp ON gp.academic_year_id = e.academic_year_id AND gp.id = ?
            INNER JOIN schools sch ON sch.id = s.school_id
            WHERE s.id = ? AND s.school_id = ? AND s.status = "ACTIVE"
            ORDER BY ay.is_current DESC
            LIMIT 1
        ');
        $stmt->execute([$periodId, $studentId, $schoolId]);
        $context = $stmt->fetch();
        if (!$context) return false;
        if (($user['role'] ?? '') === 'professeur') {
            $allowed = Database::connect()->prepare('
                SELECT 1 FROM teacher_assignments
                WHERE school_id = ? AND teacher_id = ? AND academic_year_id = ?
                  AND class_level_id = ? AND status = "ACTIVE" LIMIT 1
            ');
            $allowed->execute([$schoolId, (int)$user['id'], $context['academic_year_id'], $context['class_level_id']]);
            if (!$allowed->fetchColumn()) return false;
        }
        return $context;
    }

    private function results(array $context, int $periodId): array
    {
        $user = Request::get('auth_user', []);
        $conditions = '';
        $schoolId = (int)($user['school_id'] ?? 0);
        if (($user['role'] ?? '') === 'professeur') {
            $conditions = ' AND ta.teacher_id = ?';
        }
        $stmt = Database::connect()->prepare('
            SELECT sub.name AS subject_name, sub.code AS subject_code,
                   CONCAT_WS(" ", teacher.first_name, teacher.last_name) AS teacher_name,
                   ROUND(
                       SUM(CASE WHEN sg.attendance_status = "PRESENT" AND sg.score IS NOT NULL
                           THEN (sg.score / a.max_score) * 20 * a.coefficient ELSE 0 END)
                       / NULLIF(SUM(CASE WHEN sg.attendance_status = "PRESENT" AND sg.score IS NOT NULL
                           THEN a.coefficient ELSE 0 END), 0), 2
                   ) AS average,
                   COUNT(CASE WHEN sg.attendance_status = "PRESENT" AND sg.score IS NOT NULL THEN 1 END) AS grade_count,
                   SUM(sg.attendance_status = "ABSENT") AS assessment_absence_count
            FROM teacher_assignments ta
            INNER JOIN subjects sub ON sub.id = ta.subject_id
            INNER JOIN users teacher ON teacher.id = ta.teacher_id
            LEFT JOIN assessments a ON a.teacher_assignment_id = ta.id AND a.grading_period_id = ?
                AND a.status IN ("PUBLISHED", "LOCKED")
            LEFT JOIN student_grades sg ON sg.assessment_id = a.id AND sg.enrollment_id = ?
            WHERE ta.school_id = ? AND ta.academic_year_id = ? AND ta.class_level_id = ?
                AND ta.status = "ACTIVE"' . $conditions . '
            GROUP BY sub.id, sub.name, sub.code, teacher.id, teacher.first_name, teacher.last_name
            ORDER BY sub.sort_order, sub.name
        ');
        $ordered = [$periodId, $context['enrollment_id'], $schoolId, $context['academic_year_id'], $context['class_level_id']];
        if (($user['role'] ?? '') === 'professeur') $ordered[] = (int)$user['id'];
        $stmt->execute($ordered);
        return $stmt->fetchAll();
    }

    private function html(array $context, array $rows, ?float $overall, string $language): string
    {
        $ar = $language === 'ar';
        $labels = $ar
            ? ['title' => 'بيان النتائج الدراسية', 'student' => 'التلميذ(ة)', 'class' => 'القسم', 'year' => 'السنة الدراسية', 'period' => 'الفترة', 'subject' => 'المادة', 'teacher' => 'الأستاذ(ة)', 'count' => 'عدد النقط', 'average' => 'المعدل / 20', 'overall' => 'المعدل العام', 'signature' => 'توقيع الأستاذ(ة)', 'stamp' => 'خاتم المؤسسة', 'footer' => 'وثيقة مدرسية صادرة عن المؤسسة.']
            : ['title' => 'RELEVÉ DES RÉSULTATS', 'student' => 'Élève', 'class' => 'Classe', 'year' => 'Année scolaire', 'period' => 'Période', 'subject' => 'Matière', 'teacher' => 'Professeur', 'count' => 'Notes', 'average' => 'Moyenne / 20', 'overall' => 'Moyenne générale', 'signature' => 'Signature du professeur', 'stamp' => 'Cachet de l’établissement', 'footer' => 'Document scolaire délivré par l’établissement.'];
        $logo = $this->logo((string)$context['school_logo_path']);
        $logoHtml = $logo ? '<img class="logo" src="' . $this->e($logo) . '">' : '';
        $body = '';
        foreach ($rows as $row) {
            $average = $row['average'] === null ? '—' : number_format((float)$row['average'], 2, ',', ' ');
            $body .= '<tr><td>' . $this->e($row['subject_name']) . '</td><td>' . $this->e($row['teacher_name']) . '</td><td>' . (int)$row['grade_count'] . '</td><td><strong>' . $average . '</strong></td></tr>';
        }
        if ($body === '') $body = '<tr><td colspan="4">—</td></tr>';
        $overallLabel = $overall === null ? '—' : number_format($overall, 2, ',', ' ') . ' / 20';
        $primary = preg_match('/^#[0-9a-f]{6}$/i', (string)$context['primary_color']) ? $context['primary_color'] : '#0f172a';
        return '<!doctype html><html lang="' . $language . '" dir="' . ($ar ? 'rtl' : 'ltr') . '"><head><meta charset="UTF-8"><style>@page{margin:28px}body{font-family:DejaVu Sans,sans-serif;color:#0f172a;font-size:11px}.document{border:1px solid #cbd5e1;padding:24px}.header{width:100%;border-bottom:3px solid ' . $primary . ';padding-bottom:14px}.logo{width:62px;height:62px;object-fit:contain}.school{font-size:22px;font-weight:bold;color:' . $primary . '}.title{text-align:center;font-size:20px;font-weight:bold;margin:24px}.meta,.results{width:100%;border-collapse:collapse}.meta td,.results th,.results td{border:1px solid #cbd5e1;padding:9px}.meta .label,.results th{background:#f1f5f9;font-weight:bold}.overall{margin:18px 0;padding:14px;text-align:center;border:2px solid ' . $primary . ';font-size:17px}.sign{width:100%;margin-top:44px}.sign td{width:50%;height:80px;text-align:center}.line{margin:50px 25px 0;border-top:1px solid #94a3b8}.footer{text-align:center;border-top:1px solid #cbd5e1;padding-top:10px;color:#64748b}</style></head><body><div class="document"><table class="header"><tr><td style="width:80px">' . $logoHtml . '</td><td><div class="school">' . $this->e($context['school_name']) . '</div><div>' . $this->e(trim($context['school_address'] . ' ' . $context['school_city'])) . '</div><div>' . $this->e($context['school_phone']) . '</div></td></tr></table><div class="title">' . $labels['title'] . '</div><table class="meta"><tr><td class="label">' . $labels['student'] . '</td><td>' . $this->e($context['first_name'] . ' ' . $context['last_name']) . '</td><td class="label">' . $labels['class'] . '</td><td>' . $this->e($context['class_name']) . '</td></tr><tr><td class="label">' . $labels['year'] . '</td><td>' . $this->e($context['academic_year_name']) . '</td><td class="label">' . $labels['period'] . '</td><td>' . $this->e($context['period_name']) . '</td></tr></table><table class="results" style="margin-top:18px"><thead><tr><th>' . $labels['subject'] . '</th><th>' . $labels['teacher'] . '</th><th>' . $labels['count'] . '</th><th>' . $labels['average'] . '</th></tr></thead><tbody>' . $body . '</tbody></table><div class="overall"><strong>' . $labels['overall'] . ' : ' . $overallLabel . '</strong></div><table class="sign"><tr><td>' . $labels['signature'] . '<div class="line"></div></td><td>' . $labels['stamp'] . '<div class="line"></div></td></tr></table><div class="footer">' . $labels['footer'] . '</div></div></body></html>';
    }

    private function logo(string $path): ?string
    {
        if ($path === '' || preg_match('/^https?:\/\//i', $path)) return null;
        $root = realpath(__DIR__ . '/../../public');
        $absolute = $root ? realpath($root . '/' . ltrim(str_replace('\\', '/', $path), '/')) : false;
        if (!$root || !$absolute || !str_starts_with($absolute, $root) || !is_file($absolute)) return null;
        $content = file_get_contents($absolute);
        if ($content === false) return null;
        return 'data:' . (mime_content_type($absolute) ?: 'image/png') . ';base64,' . base64_encode($content);
    }

    private function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
