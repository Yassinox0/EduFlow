<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use Throwable;

class GradeService
{
    private const TYPES = ['CONTROL', 'HOMEWORK', 'EXAM'];

    public function dashboard(): array
    {
        [$userId, $schoolId] = $this->scope();
        $pdo = Database::connect();
        $assignments = $this->assignments();
        $stmt = $pdo->prepare('
            SELECT
                COUNT(*) AS assessment_count,
                SUM(a.status = "DRAFT") AS draft_count,
                SUM(a.status IN ("PUBLISHED", "LOCKED")) AS published_count
            FROM assessments a
            INNER JOIN teacher_assignments ta ON ta.id = a.teacher_assignment_id
            WHERE a.school_id = ? AND ta.teacher_id = ?
        ');
        $stmt->execute([$schoolId, $userId]);
        $stats = $stmt->fetch() ?: [];
        $today = (new AttendanceService())->sessions(['date' => date('Y-m-d')]);
        [$yearValue, $weekNumber] = $this->currentAcademicWeek();
        $workloads = (new ScheduleService())->getWorkloads([
            'teacher_id' => $userId,
            'year_value' => $yearValue,
            'week_number' => $weekNumber,
        ]);
        $workload = isset($workloads[0]) && is_array($workloads[0]) ? $workloads[0] : [];
        return [
            'assignments' => $assignments,
            'stats' => [
                'assignment_count' => count($assignments),
                'assessment_count' => (int)($stats['assessment_count'] ?? 0),
                'draft_count' => (int)($stats['draft_count'] ?? 0),
                'published_count' => (int)($stats['published_count'] ?? 0),
                'today_session_count' => count($today['sessions'] ?? []),
                'assigned_weekly_hours' => (float)($workload['assigned_hours'] ?? 0),
                'scheduled_weekly_hours' => (float)($workload['scheduled_hours'] ?? 0),
                'remaining_weekly_hours' => (float)($workload['remaining_hours'] ?? 0),
                'external_weekly_hours' => (float)($workload['external_hours'] ?? 0),
            ],
            'workload' => $workload,
            'today_sessions' => $today['sessions'] ?? [],
        ];
    }

    private function currentAcademicWeek(): array
    {
        $today = new \DateTimeImmutable('today');
        $year = (int)$today->format('n') >= 8 ? (int)$today->format('Y') : (int)$today->format('Y') - 1;
        $septemberFirst = new \DateTimeImmutable(sprintf('%d-09-01', $year));
        $calendarStart = $septemberFirst->modify('-' . ((int)$septemberFirst->format('N') - 1) . ' days');
        $days = (int)$calendarStart->diff($today)->format('%r%a');
        $week = max(1, min(53, intdiv(max(0, $days), 7) + 1));
        return [$year, $week];
    }

    public function catalog(array $filters = []): array
    {
        [$userId, $schoolId, $role] = $this->scope(true);
        $pdo = Database::connect();
        $conditions = ['a.school_id = ?'];
        $params = [$schoolId];
        if ($role === 'professeur') {
            $conditions[] = 'ta.teacher_id = ?';
            $params[] = $userId;
        }
        foreach (['teacher_assignment_id', 'grading_period_id'] as $field) {
            $value = (int)($filters[$field] ?? 0);
            if ($value > 0) {
                $conditions[] = 'a.' . $field . ' = ?';
                $params[] = $value;
            }
        }
        $stmt = $pdo->prepare('
            SELECT a.*, gp.code AS period_code, gp.name AS period_name,
                   ta.teacher_id, ta.subject_id, ta.class_level_id, ta.academic_year_id,
                   sub.name AS subject_name, sub.code AS subject_code,
                   cl.name AS class_name, cl.level_name, cl.group_name,
                   CONCAT_WS(" ", u.first_name, u.last_name) AS teacher_name,
                   COUNT(sg.id) AS entered_grade_count
            FROM assessments a
            INNER JOIN grading_periods gp ON gp.id = a.grading_period_id
            INNER JOIN teacher_assignments ta ON ta.id = a.teacher_assignment_id
            INNER JOIN subjects sub ON sub.id = ta.subject_id
            INNER JOIN class_levels cl ON cl.id = ta.class_level_id
            INNER JOIN users u ON u.id = ta.teacher_id
            LEFT JOIN student_grades sg ON sg.assessment_id = a.id
            WHERE ' . implode(' AND ', $conditions) . '
            GROUP BY a.id, gp.code, gp.name, ta.teacher_id, ta.subject_id, ta.class_level_id,
                     ta.academic_year_id, sub.name, sub.code, cl.name, cl.level_name,
                     cl.group_name, u.first_name, u.last_name
            ORDER BY a.assessment_date DESC, a.id DESC
        ');
        $stmt->execute($params);
        return [
            'assignments' => $this->assignments(),
            'periods' => $this->periods(),
            'assessments' => $stmt->fetchAll(),
        ];
    }

    public function createAssessment(array $data): array
    {
        [$userId, $schoolId] = $this->scope();
        $assignmentId = (int)($data['teacher_assignment_id'] ?? 0);
        $periodId = (int)($data['grading_period_id'] ?? 0);
        $title = trim((string)($data['title'] ?? ''));
        $type = strtoupper(trim((string)($data['assessment_type'] ?? 'CONTROL')));
        $date = trim((string)($data['assessment_date'] ?? ''));
        $maxScore = (float)($data['max_score'] ?? 20);
        $coefficient = (float)($data['coefficient'] ?? 1);
        if ($title === '' || !$this->validDate($date) || !in_array($type, self::TYPES, true)) {
            return ['error' => 'Title, valid date and assessment type are required'];
        }
        if ($maxScore <= 0 || $maxScore > 1000 || $coefficient <= 0 || $coefficient > 100) {
            return ['error' => 'Maximum score or coefficient is invalid'];
        }
        $pdo = Database::connect();
        $assignment = $this->assignment($assignmentId);
        if (!$assignment) return ['error' => 'This assignment does not belong to the connected teacher'];
        $stmt = $pdo->prepare('
            SELECT id FROM grading_periods
            WHERE id = ? AND school_id = ? AND academic_year_id = ? AND status = "ACTIVE"
        ');
        $stmt->execute([$periodId, $schoolId, $assignment['academic_year_id']]);
        if (!$stmt->fetch()) return ['error' => 'The grading period is invalid or closed'];

        $stmt = $pdo->prepare('
            INSERT INTO assessments (
                school_id, teacher_assignment_id, grading_period_id, title, assessment_type,
                assessment_date, max_score, coefficient, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "DRAFT", ?)
        ');
        $stmt->execute([$schoolId, $assignmentId, $periodId, $title, $type, $date, $maxScore, $coefficient, $userId]);
        return ['id' => (int)$pdo->lastInsertId(), 'message' => 'Assessment created successfully'];
    }

    public function roster(int $assessmentId): array
    {
        $assessment = $this->assessment($assessmentId);
        if (!$assessment) return ['error' => 'Assessment not found or forbidden'];
        $stmt = Database::connect()->prepare('
            SELECT e.id AS enrollment_id, s.id AS student_id, s.first_name, s.last_name, s.photo_path,
                   sg.id AS grade_id, sg.score, sg.attendance_status, sg.remark
            FROM enrollments e
            INNER JOIN students s ON s.id = e.student_id
            LEFT JOIN student_grades sg ON sg.assessment_id = ? AND sg.enrollment_id = e.id
            WHERE e.school_id = ? AND e.academic_year_id = ? AND e.class_level_id = ?
              AND e.status = "ACTIVE" AND s.status = "ACTIVE"
            ORDER BY s.last_name, s.first_name
        ');
        $stmt->execute([$assessmentId, $assessment['school_id'], $assessment['academic_year_id'], $assessment['class_level_id']]);
        $students = $stmt->fetchAll();
        $history = Database::connect()->prepare('
            SELECT gh.id, gh.action, gh.created_at, s.first_name, s.last_name,
                   CONCAT_WS(" ", actor.first_name, actor.last_name) AS actor_name
            FROM grade_history gh
            INNER JOIN enrollments e ON e.id = gh.enrollment_id
            INNER JOIN students s ON s.id = e.student_id
            INNER JOIN users actor ON actor.id = gh.actor_id
            WHERE gh.assessment_id = ? AND gh.school_id = ?
            ORDER BY gh.created_at DESC, gh.id DESC
            LIMIT 30
        ');
        $history->execute([$assessmentId, $assessment['school_id']]);
        return ['assessment' => $assessment, 'students' => $students, 'history' => $history->fetchAll()];
    }

    public function saveGrades(int $assessmentId, array $data): array
    {
        $assessment = $this->assessment($assessmentId);
        if (!$assessment) return ['error' => 'Assessment not found or forbidden'];
        if ($assessment['status'] !== 'DRAFT') return ['error' => 'Published or locked results must be reopened by administration before editing'];
        $rows = is_array($data['grades'] ?? null) ? $data['grades'] : [];
        $allowed = $this->allowedEnrollments($assessment);
        [$userId, $schoolId] = $this->scope();
        $pdo = Database::connect();
        try {
            $pdo->beginTransaction();
            $find = $pdo->prepare('SELECT * FROM student_grades WHERE assessment_id = ? AND enrollment_id = ? LIMIT 1');
            $upsert = $pdo->prepare('
                INSERT INTO student_grades (
                    school_id, assessment_id, enrollment_id, score, attendance_status, remark, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE score = VALUES(score), attendance_status = VALUES(attendance_status),
                    remark = VALUES(remark), updated_by = VALUES(updated_by), updated_at = NOW(), id = LAST_INSERT_ID(id)
            ');
            $history = $pdo->prepare('
                INSERT INTO grade_history (
                    school_id, grade_id, assessment_id, enrollment_id, actor_id, action, old_value, new_value
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $saved = 0;
            foreach ($rows as $row) {
                $enrollmentId = (int)($row['enrollment_id'] ?? 0);
                if (!isset($allowed[$enrollmentId])) return $this->rollbackError($pdo, 'A student is not enrolled in this class');
                $attendance = strtoupper((string)($row['attendance_status'] ?? 'PRESENT'));
                if (!in_array($attendance, ['PRESENT', 'ABSENT', 'EXCUSED'], true)) $attendance = 'PRESENT';
                $score = $row['score'] === '' || $row['score'] === null || $attendance !== 'PRESENT' ? null : (float)$row['score'];
                if ($score !== null && ($score < 0 || $score > (float)$assessment['max_score'])) {
                    return $this->rollbackError($pdo, 'A score exceeds the assessment scale');
                }
                $remark = $this->nullableText($row['remark'] ?? null, 500);
                $find->execute([$assessmentId, $enrollmentId]);
                $old = $find->fetch() ?: null;
                $upsert->execute([$schoolId, $assessmentId, $enrollmentId, $score, $attendance, $remark, $userId]);
                $gradeId = (int)$pdo->lastInsertId();
                $new = ['score' => $score, 'attendance_status' => $attendance, 'remark' => $remark];
                $history->execute([$schoolId, $gradeId, $assessmentId, $enrollmentId, $userId,
                    $old ? 'UPDATED' : 'CREATED', $old ? json_encode($old, JSON_UNESCAPED_UNICODE) : null,
                    json_encode($new, JSON_UNESCAPED_UNICODE)]);
                $saved++;
            }
            $pdo->commit();
            return ['saved_count' => $saved, 'message' => 'Grades saved successfully'];
        } catch (Throwable) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            return ['error' => 'Grades could not be saved'];
        }
    }

    public function updateStatus(int $assessmentId, string $status): array
    {
        $assessment = $this->assessment($assessmentId, true);
        if (!$assessment) return ['error' => 'Assessment not found or forbidden'];
        $status = strtoupper(trim($status));
        [, , $role] = $this->scope(true);
        if ($role === 'professeur' && !in_array($status, ['DRAFT', 'PUBLISHED'], true)) {
            return ['error' => 'Only administration can lock an assessment'];
        }
        if ($role === 'admin' && !in_array($status, ['DRAFT', 'PUBLISHED', 'LOCKED'], true)) {
            return ['error' => 'Invalid assessment status'];
        }
        if ($status === 'PUBLISHED') {
            $missing = $this->missingGrades($assessment);
            if ($missing > 0) return ['error' => 'All students need a grade or an absence status before publication'];
        }
        $stmt = Database::connect()->prepare('
            UPDATE assessments SET status = ?,
                published_at = IF(? = "PUBLISHED", NOW(), published_at),
                locked_at = IF(? = "LOCKED", NOW(), NULL)
            WHERE id = ? AND school_id = ?
        ');
        $stmt->execute([$status, $status, $status, $assessmentId, $assessment['school_id']]);
        $action = match ($status) {
            'PUBLISHED' => 'PUBLISHED',
            'LOCKED' => 'LOCKED',
            default => 'UNLOCKED',
        };
        $audit = Database::connect()->prepare('
            INSERT INTO grade_history (
                school_id, grade_id, assessment_id, enrollment_id, actor_id, action, old_value, new_value
            )
            SELECT ?, sg.id, sg.assessment_id, sg.enrollment_id, ?, ?,
                   JSON_OBJECT("status", ?), JSON_OBJECT("status", ?)
            FROM student_grades sg WHERE sg.assessment_id = ?
        ');
        $audit->execute([$assessment['school_id'], (int)$this->scope()[0], $action, $assessment['status'], $status, $assessmentId]);
        return ['id' => $assessmentId, 'status' => $status, 'message' => 'Assessment status updated'];
    }

    public function gradebook(array $filters): array
    {
        $assignment = $this->assignment((int)($filters['teacher_assignment_id'] ?? 0));
        if (!$assignment) return ['error' => 'Teacher assignment not found or forbidden'];
        $periodId = (int)($filters['grading_period_id'] ?? 0);
        $stmt = Database::connect()->prepare('
            SELECT e.id AS enrollment_id, s.id AS student_id, s.first_name, s.last_name,
                   ROUND(
                       SUM(CASE WHEN sg.id IS NOT NULL THEN (sg.score / a.max_score) * 20 * a.coefficient ELSE 0 END)
                       / NULLIF(SUM(CASE WHEN sg.id IS NOT NULL THEN a.coefficient ELSE 0 END), 0),
                       2
                   ) AS average,
                   COUNT(sg.id) AS grade_count
            FROM enrollments e
            INNER JOIN students s ON s.id = e.student_id
            LEFT JOIN assessments a ON a.teacher_assignment_id = ? AND a.grading_period_id = ?
                AND a.status IN ("PUBLISHED", "LOCKED")
            LEFT JOIN student_grades sg ON sg.assessment_id = a.id AND sg.enrollment_id = e.id
                AND sg.attendance_status = "PRESENT" AND sg.score IS NOT NULL
            WHERE e.school_id = ? AND e.academic_year_id = ? AND e.class_level_id = ?
              AND e.status = "ACTIVE" AND s.status = "ACTIVE"
            GROUP BY e.id, s.id, s.first_name, s.last_name
            ORDER BY s.last_name, s.first_name
        ');
        $stmt->execute([$assignment['id'], $periodId, $assignment['school_id'], $assignment['academic_year_id'], $assignment['class_level_id']]);
        return ['assignment' => $assignment, 'students' => $stmt->fetchAll()];
    }

    private function assignments(): array
    {
        [$userId, $schoolId] = $this->scope();
        $stmt = Database::connect()->prepare('
            SELECT ta.id, ta.school_id, ta.academic_year_id, ta.teacher_id, ta.subject_id,
                   ta.class_level_id, ta.weekly_hours, ay.name AS academic_year_name,
                   sub.name AS subject_name, sub.code AS subject_code,
                   cl.name AS class_name, cl.level_name, cl.group_name
            FROM teacher_assignments ta
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            INNER JOIN subjects sub ON sub.id = ta.subject_id
            INNER JOIN class_levels cl ON cl.id = ta.class_level_id
            WHERE ta.school_id = ? AND ta.teacher_id = ? AND ta.status = "ACTIVE"
            ORDER BY ay.is_current DESC, cl.sort_order, sub.sort_order
        ');
        $stmt->execute([$schoolId, $userId]);
        return $stmt->fetchAll();
    }

    private function periods(): array
    {
        [, $schoolId] = $this->scope();
        $stmt = Database::connect()->prepare('
            SELECT gp.*, ay.name AS academic_year_name, ay.is_current
            FROM grading_periods gp INNER JOIN academic_years ay ON ay.id = gp.academic_year_id
            WHERE gp.school_id = ? ORDER BY ay.is_current DESC, gp.start_date, gp.id
        ');
        $stmt->execute([$schoolId]);
        return $stmt->fetchAll();
    }

    private function assignment(int $id): array|false
    {
        [$userId, $schoolId, $role] = $this->scope(true);
        $sql = '
            SELECT ta.*, ay.name AS academic_year_name, sub.name AS subject_name, sub.code AS subject_code,
                   cl.name AS class_name, cl.level_name, cl.group_name
            FROM teacher_assignments ta
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            INNER JOIN subjects sub ON sub.id = ta.subject_id
            INNER JOIN class_levels cl ON cl.id = ta.class_level_id
            WHERE ta.id = ? AND ta.school_id = ? AND ta.status = "ACTIVE"';
        $params = [$id, $schoolId];
        if ($role === 'professeur') {
            $sql .= ' AND ta.teacher_id = ?';
            $params[] = $userId;
        }
        $stmt = Database::connect()->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return $stmt->fetch() ?: false;
    }

    private function assessment(int $id, bool $allowAdmin = false): array|false
    {
        [$userId, $schoolId, $role] = $this->scope(true);
        $sql = '
            SELECT a.*, ta.teacher_id, ta.subject_id, ta.class_level_id, ta.academic_year_id,
                   sub.name AS subject_name, sub.code AS subject_code, cl.name AS class_name,
                   cl.level_name, cl.group_name, gp.name AS period_name, gp.code AS period_code
            FROM assessments a
            INNER JOIN teacher_assignments ta ON ta.id = a.teacher_assignment_id
            INNER JOIN subjects sub ON sub.id = ta.subject_id
            INNER JOIN class_levels cl ON cl.id = ta.class_level_id
            INNER JOIN grading_periods gp ON gp.id = a.grading_period_id
            WHERE a.id = ? AND a.school_id = ?';
        $params = [$id, $schoolId];
        if ($role === 'professeur' || !$allowAdmin) {
            $sql .= ' AND ta.teacher_id = ?';
            $params[] = $userId;
        }
        $stmt = Database::connect()->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return $stmt->fetch() ?: false;
    }

    private function allowedEnrollments(array $assessment): array
    {
        $stmt = Database::connect()->prepare('
            SELECT id FROM enrollments
            WHERE school_id = ? AND academic_year_id = ? AND class_level_id = ? AND status = "ACTIVE"
        ');
        $stmt->execute([$assessment['school_id'], $assessment['academic_year_id'], $assessment['class_level_id']]);
        return array_fill_keys(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)), true);
    }

    private function missingGrades(array $assessment): int
    {
        $stmt = Database::connect()->prepare('
            SELECT COUNT(*) FROM enrollments e
            LEFT JOIN student_grades sg ON sg.enrollment_id = e.id AND sg.assessment_id = ?
            WHERE e.school_id = ? AND e.academic_year_id = ? AND e.class_level_id = ?
              AND e.status = "ACTIVE" AND sg.id IS NULL
        ');
        $stmt->execute([$assessment['id'], $assessment['school_id'], $assessment['academic_year_id'], $assessment['class_level_id']]);
        return (int)$stmt->fetchColumn();
    }

    private function scope(bool $withRole = false): array
    {
        $user = Request::get('auth_user', []);
        $scope = [(int)($user['id'] ?? 0), (int)($user['school_id'] ?? 0)];
        if ($withRole) $scope[] = (string)($user['role'] ?? '');
        return $scope;
    }

    private function rollbackError(PDO $pdo, string $message): array
    {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return ['error' => $message];
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
