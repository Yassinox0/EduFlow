<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use Throwable;

class AttendanceService
{
    private const DAYS = [1 => 'MONDAY', 2 => 'TUESDAY', 3 => 'WEDNESDAY', 4 => 'THURSDAY', 5 => 'FRIDAY', 6 => 'SATURDAY', 7 => 'SUNDAY'];

    public function sessions(array $filters = []): array
    {
        [$teacherId, $schoolId] = $this->scope();
        $date = $this->validDate((string)($filters['date'] ?? '')) ? (string)$filters['date'] : date('Y-m-d');
        $day = self::DAYS[(int)(new \DateTimeImmutable($date))->format('N')];
        $stmt = Database::connect()->prepare('
            SELECT sc.id, sc.class_level_id, sc.subject_id, sc.subject, sc.room,
                   sc.day_of_week, sc.start_time, sc.end_time,
                   cl.name AS class_name, cl.level_name, cl.group_name,
                   sub.name AS subject_name, sub.code AS subject_code,
                   ats.id AS attendance_session_id, ats.status AS attendance_status,
                   COUNT(sa.id) AS absent_count
            FROM schedules sc
            INNER JOIN class_levels cl ON cl.id = sc.class_level_id
            INNER JOIN subjects sub ON sub.id = sc.subject_id
            LEFT JOIN attendance_sessions ats ON ats.schedule_id = sc.id AND ats.session_date = ?
            LEFT JOIN student_absences sa ON sa.attendance_session_id = ats.id
            WHERE sc.school_id = ? AND sc.teacher_id = ? AND sc.day_of_week = ?
              AND sc.status = "ACTIVE" AND sc.schedule_type = "eduflow_course"
              AND EXISTS (
                  SELECT 1 FROM teacher_assignments ta
                  WHERE ta.school_id = sc.school_id AND ta.teacher_id = sc.teacher_id
                    AND ta.class_level_id = sc.class_level_id AND ta.subject_id = sc.subject_id
                    AND ta.status = "ACTIVE"
              )
            GROUP BY sc.id, sc.class_level_id, sc.subject_id, sc.subject, sc.room,
                     sc.day_of_week, sc.start_time, sc.end_time, cl.name, cl.level_name,
                     cl.group_name, sub.name, sub.code, ats.id, ats.status
            ORDER BY sc.start_time, cl.name
        ');
        $stmt->execute([$date, $schoolId, $teacherId, $day]);
        return ['date' => $date, 'day_of_week' => $day, 'sessions' => $stmt->fetchAll()];
    }

    public function roster(int $scheduleId, string $date): array
    {
        $context = $this->scheduleContext($scheduleId, $date);
        if (isset($context['error'])) return $context;
        $stmt = Database::connect()->prepare('
            SELECT e.id AS enrollment_id, s.id AS student_id, s.first_name, s.last_name, s.photo_path,
                   sa.status AS absence_status, sa.reason, sa.note
            FROM enrollments e
            INNER JOIN students s ON s.id = e.student_id
            LEFT JOIN attendance_sessions ats ON ats.schedule_id = ? AND ats.session_date = ?
            LEFT JOIN student_absences sa ON sa.attendance_session_id = ats.id AND sa.enrollment_id = e.id
            WHERE e.school_id = ? AND e.academic_year_id = ? AND e.class_level_id = ?
              AND e.status = "ACTIVE" AND s.status = "ACTIVE"
            ORDER BY s.last_name, s.first_name
        ');
        $stmt->execute([$scheduleId, $date, $context['school_id'], $context['academic_year_id'], $context['class_level_id']]);
        return ['session' => $context, 'students' => $stmt->fetchAll()];
    }

    public function save(int $scheduleId, array $data): array
    {
        $date = trim((string)($data['session_date'] ?? ''));
        $context = $this->scheduleContext($scheduleId, $date);
        if (isset($context['error'])) return $context;
        if ($date > date('Y-m-d')) return ['error' => 'Future attendance cannot be recorded'];

        $absences = is_array($data['absences'] ?? null) ? $data['absences'] : [];
        $ids = array_values(array_unique(array_filter(array_map(
            static fn($row): int => (int)($row['enrollment_id'] ?? 0),
            $absences
        ))));
        $allowed = $this->allowedEnrollmentIds($context);
        foreach ($ids as $id) {
            if (!isset($allowed[$id])) return ['error' => 'A selected student is not enrolled in this class'];
        }

        [$teacherId, $schoolId] = $this->scope();
        $pdo = Database::connect();
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('
                INSERT INTO attendance_sessions (
                    school_id, schedule_id, teacher_id, class_level_id, subject_id,
                    session_date, start_time, end_time, status, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "COMPLETED", NOW())
                ON DUPLICATE KEY UPDATE status = "COMPLETED", completed_at = NOW(), updated_at = NOW(), id = LAST_INSERT_ID(id)
            ');
            $stmt->execute([$schoolId, $scheduleId, $teacherId, $context['class_level_id'], $context['subject_id'], $date, $context['start_time'], $context['end_time']]);
            $sessionId = (int)$pdo->lastInsertId();
            if ($sessionId <= 0) {
                $find = $pdo->prepare('SELECT id FROM attendance_sessions WHERE schedule_id = ? AND session_date = ?');
                $find->execute([$scheduleId, $date]);
                $sessionId = (int)$find->fetchColumn();
            }
            $pdo->prepare('DELETE FROM student_absences WHERE attendance_session_id = ?')->execute([$sessionId]);
            $insert = $pdo->prepare('
                INSERT INTO student_absences (
                    school_id, attendance_session_id, enrollment_id, status, reason, note, recorded_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ');
            foreach ($absences as $absence) {
                $enrollmentId = (int)($absence['enrollment_id'] ?? 0);
                if (!isset($allowed[$enrollmentId])) continue;
                $status = strtoupper((string)($absence['status'] ?? 'ABSENT')) === 'EXCUSED' ? 'EXCUSED' : 'ABSENT';
                $insert->execute([$schoolId, $sessionId, $enrollmentId, $status,
                    $this->nullableText($absence['reason'] ?? null, 255),
                    $this->nullableText($absence['note'] ?? null, 500), $teacherId]);
            }
            $pdo->commit();
            return ['id' => $sessionId, 'absent_count' => count($ids), 'message' => 'Attendance saved successfully'];
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            return ['error' => 'Attendance could not be saved'];
        }
    }

    private function scheduleContext(int $scheduleId, string $date): array
    {
        if ($scheduleId <= 0 || !$this->validDate($date)) return ['error' => 'Valid schedule and session date are required'];
        [$teacherId, $schoolId] = $this->scope();
        $day = self::DAYS[(int)(new \DateTimeImmutable($date))->format('N')];
        $stmt = Database::connect()->prepare('
            SELECT sc.*, cl.name AS class_name, sub.name AS subject_name,
                   ta.id AS teacher_assignment_id, ta.academic_year_id
            FROM schedules sc
            INNER JOIN class_levels cl ON cl.id = sc.class_level_id
            INNER JOIN subjects sub ON sub.id = sc.subject_id
            INNER JOIN teacher_assignments ta ON ta.school_id = sc.school_id
                AND ta.teacher_id = sc.teacher_id AND ta.class_level_id = sc.class_level_id
                AND ta.subject_id = sc.subject_id AND ta.status = "ACTIVE"
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            WHERE sc.id = ? AND sc.school_id = ? AND sc.teacher_id = ?
              AND sc.day_of_week = ? AND sc.status = "ACTIVE" AND sc.schedule_type = "eduflow_course"
            ORDER BY ay.is_current DESC, ay.start_date DESC
            LIMIT 1
        ');
        $stmt->execute([$scheduleId, $schoolId, $teacherId, $day]);
        return $stmt->fetch() ?: ['error' => 'This course does not belong to the connected teacher or does not match the selected date'];
    }

    private function allowedEnrollmentIds(array $context): array
    {
        $stmt = Database::connect()->prepare('
            SELECT id FROM enrollments
            WHERE school_id = ? AND academic_year_id = ? AND class_level_id = ? AND status = "ACTIVE"
        ');
        $stmt->execute([$context['school_id'], $context['academic_year_id'], $context['class_level_id']]);
        return array_fill_keys(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)), true);
    }

    private function scope(): array
    {
        $user = Request::get('auth_user', []);
        return [(int)($user['id'] ?? 0), (int)($user['school_id'] ?? 0)];
    }

    private function validDate(string $date): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        return $parsed && $parsed->format('Y-m-d') === $date;
    }

    private function nullableText(mixed $value, int $max): ?string
    {
        $text = trim((string)$value);
        if ($text === '') return null;
        return function_exists('mb_substr') ? mb_substr($text, 0, $max, 'UTF-8') : substr($text, 0, $max);
    }
}
