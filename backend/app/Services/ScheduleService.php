<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use PDOException;

class ScheduleService
{
    private const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    public function getAll(array $filters = []): array
    {
        $pdo = Database::connect();
        [$role, $schoolId] = $this->authScope();

        $conditions = [];
        $params = [];

        if ($role === 'super_admin') {
            $requestedSchoolId = isset($filters['school_id']) ? (int)$filters['school_id'] : 0;
            if ($requestedSchoolId > 0) {
                $conditions[] = 'sc.school_id = ?';
                $params[] = $requestedSchoolId;
            }
        } else {
            $conditions[] = 'sc.school_id = ?';
            $params[] = $schoolId;
            if ($role === 'professeur') {
                $conditions[] = 'sc.teacher_id = ?';
                $params[] = (int)(Request::get('auth_user', [])['id'] ?? 0);
            }
        }

        $classLevelId = isset($filters['class_level_id']) ? (int)$filters['class_level_id'] : 0;
        if ($classLevelId > 0) {
            $conditions[] = 'sc.class_level_id = ?';
            $params[] = $classLevelId;
        }

        $day = strtoupper(trim((string)($filters['day_of_week'] ?? '')));
        if ($day !== '' && in_array($day, self::DAYS, true)) {
            $conditions[] = 'sc.day_of_week = ?';
            $params[] = $day;
        }

        $status = strtoupper(trim((string)($filters['status'] ?? '')));
        if ($status !== '' && in_array($status, ['ACTIVE', 'CANCELLED'], true)) {
            $conditions[] = 'sc.status = ?';
            $params[] = $status;
        }

        $teacherId = $role === 'professeur' ? 0 : (isset($filters['teacher_id']) ? (int)$filters['teacher_id'] : 0);
        $teacherName = trim((string)($filters['teacher_name'] ?? ''));

        if ($teacherId > 0 && $teacherName !== '') {
            $conditions[] = '(sc.teacher_id = ? OR LOWER(TRIM(sc.teacher_name)) = ?)';
            $params[] = $teacherId;
            $params[] = strtolower($teacherName);
        } elseif ($teacherId > 0) {
            $conditions[] = 'sc.teacher_id = ?';
            $params[] = $teacherId;
        } elseif ($teacherName !== '') {
            $conditions[] = 'LOWER(TRIM(sc.teacher_name)) = ?';
            $params[] = strtolower($teacherName);
        }

        $yearValue = isset($filters['year_value']) ? (int)$filters['year_value'] : 0;
        if ($yearValue > 0) {
            $conditions[] = 'sc.year_value = ?';
            $params[] = $yearValue;
        }

        $weekNumber = isset($filters['week_number']) ? (int)$filters['week_number'] : 0;
        if ($weekNumber > 0) {
            $conditions[] = 'sc.week_number = ?';
            $params[] = $weekNumber;
        }

        $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $sql = "
            SELECT
                sc.*,
                sub.code AS subject_code,
                cl.code AS class_code,
                cl.group_name AS class_group_name,
                COALESCE(scl.weekly_hours, 0) AS subject_weekly_hours,
                COALESCE(cl.name, cl.group_name, 'Ailleurs') AS class_level_name,
                COALESCE(cl.level_name, cl.name) AS level_name,
                u.gender AS teacher_gender,
                s.name AS school_name
            FROM schedules sc
            LEFT JOIN subjects sub ON sub.id = sc.subject_id
            LEFT JOIN class_levels cl ON cl.id = sc.class_level_id
            LEFT JOIN subject_class_levels scl ON scl.subject_id = sc.subject_id AND scl.class_level_id = sc.class_level_id
            LEFT JOIN users u ON u.id = sc.teacher_id
            INNER JOIN schools s ON s.id = sc.school_id
            {$whereSql}
            ORDER BY sc.day_order ASC, sc.start_time ASC, COALESCE(cl.sort_order, 999) ASC, COALESCE(cl.name, sc.subject) ASC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $this->decorateSubjectSessions($stmt->fetchAll());
    }

    public function getWorkloads(array $filters = []): array
    {
        $pdo = Database::connect();
        [$role, $schoolId] = $this->authScope();
        if ($role === 'super_admin') {
            $schoolId = isset($filters['school_id']) ? (int)$filters['school_id'] : 0;
        }

        $yearValue = isset($filters['year_value']) ? (int)$filters['year_value'] : 0;
        $weekNumber = isset($filters['week_number']) ? (int)$filters['week_number'] : 0;
        if (!$schoolId || $yearValue < 2000 || $yearValue > 2100 || $weekNumber < 1 || $weekNumber > 53) {
            return ['error' => 'Ecole, annee scolaire et semaine valides obligatoires'];
        }

        $teacherId = $role === 'professeur'
            ? (int)(Request::get('auth_user', [])['id'] ?? 0)
            : (int)($filters['teacher_id'] ?? 0);
        $teacherSql = '
            SELECT id, first_name, last_name, photo_path
            FROM users
            WHERE school_id = ? AND role = "professeur" AND status = "ACTIVE"
        ';
        $teacherParams = [$schoolId];
        if ($teacherId > 0) {
            $teacherSql .= ' AND id = ?';
            $teacherParams[] = $teacherId;
        }
        $teacherSql .= ' ORDER BY last_name ASC, first_name ASC';
        $teacherStmt = $pdo->prepare($teacherSql);
        $teacherStmt->execute($teacherParams);
        $teachers = $teacherStmt->fetchAll();

        $assignmentStmt = $pdo->prepare('
            SELECT ta.teacher_id,
                   ROUND(SUM(ta.weekly_hours), 2) AS assigned_hours,
                   COUNT(DISTINCT ta.class_level_id) AS class_count,
                   COUNT(DISTINCT ta.subject_id) AS subject_count
            FROM teacher_assignments ta
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            WHERE ta.school_id = ? AND ta.status = "ACTIVE" AND YEAR(ay.start_date) = ?
            GROUP BY ta.teacher_id
        ');
        $assignmentStmt->execute([$schoolId, $yearValue]);
        $assignments = [];
        foreach ($assignmentStmt->fetchAll() as $row) {
            $assignments[(int)$row['teacher_id']] = $row;
        }

        $scheduleStmt = $pdo->prepare('
            SELECT teacher_id,
                   ROUND(SUM(CASE WHEN is_external = 0 THEN TIME_TO_SEC(TIMEDIFF(end_time, start_time)) ELSE 0 END) / 3600, 2) AS scheduled_hours,
                   ROUND(SUM(CASE WHEN is_external = 1 THEN TIME_TO_SEC(TIMEDIFF(end_time, start_time)) ELSE 0 END) / 3600, 2) AS external_hours,
                   COUNT(*) AS session_count
            FROM schedules
            WHERE school_id = ? AND year_value = ? AND week_number = ?
              AND status = "ACTIVE" AND teacher_id IS NOT NULL
            GROUP BY teacher_id
        ');
        $scheduleStmt->execute([$schoolId, $yearValue, $weekNumber]);
        $scheduled = [];
        foreach ($scheduleStmt->fetchAll() as $row) {
            $scheduled[(int)$row['teacher_id']] = $row;
        }

        return array_map(static function (array $teacher) use ($assignments, $scheduled): array {
            $id = (int)$teacher['id'];
            $assignedHours = (float)($assignments[$id]['assigned_hours'] ?? 0);
            $scheduledHours = (float)($scheduled[$id]['scheduled_hours'] ?? 0);
            return [
                'teacher_id' => $id,
                'teacher_name' => trim((string)$teacher['first_name'] . ' ' . (string)$teacher['last_name']),
                'photo_path' => $teacher['photo_path'] ?? null,
                'assigned_hours' => $assignedHours,
                'scheduled_hours' => $scheduledHours,
                'external_hours' => (float)($scheduled[$id]['external_hours'] ?? 0),
                'remaining_hours' => max(0, $assignedHours - $scheduledHours),
                'overload_hours' => max(0, $scheduledHours - $assignedHours),
                'session_count' => (int)($scheduled[$id]['session_count'] ?? 0),
                'class_count' => (int)($assignments[$id]['class_count'] ?? 0),
                'subject_count' => (int)($assignments[$id]['subject_count'] ?? 0),
            ];
        }, $teachers);
    }

    public function getById(int $scheduleId): array|false
    {
        if ($scheduleId <= 0) {
            return false;
        }

        $pdo = Database::connect();
        [$role, $schoolId] = $this->authScope();

        $sql = '
            SELECT sc.*, sub.code AS subject_code, cl.code AS class_code, cl.group_name AS class_group_name, COALESCE(scl.weekly_hours, 0) AS subject_weekly_hours, COALESCE(cl.name, cl.group_name, "Ailleurs") AS class_level_name, COALESCE(cl.level_name, cl.name) AS level_name, u.gender AS teacher_gender, s.name AS school_name
            FROM schedules sc
            LEFT JOIN subjects sub ON sub.id = sc.subject_id
            LEFT JOIN class_levels cl ON cl.id = sc.class_level_id
            LEFT JOIN subject_class_levels scl ON scl.subject_id = sc.subject_id AND scl.class_level_id = sc.class_level_id
            LEFT JOIN users u ON u.id = sc.teacher_id
            INNER JOIN schools s ON s.id = sc.school_id
            WHERE sc.id = ?
        ';
        $params = [$scheduleId];

        if ($role !== 'super_admin') {
            $sql .= ' AND sc.school_id = ?';
            $params[] = $schoolId;
            if ($role === 'professeur') {
                $sql .= ' AND sc.teacher_id = ?';
                $params[] = (int)(Request::get('auth_user', [])['id'] ?? 0);
            }
        }

        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        $rows = $this->decorateSubjectSessions($stmt->fetchAll());
        return $rows[0] ?? false;
    }

    public function create(array $data): array
    {
        $pdo = Database::connect();
        [$role, $schoolId] = $this->authScope();

        $isExternal = $this->isExternal($data);
        $classLevel = null;
        if (!$isExternal) {
            $classLevel = $this->resolveClassLevel($pdo, $data, $role, $schoolId);
            if (isset($classLevel['error'])) {
                return $classLevel;
            }
        }

        $payload = $this->validatedPayload($pdo, $data, $classLevel, $role, $schoolId);
        if (isset($payload['error'])) {
            return $payload;
        }

        $conflict = $this->findConflict($pdo, $payload);
        if ($conflict) {
            return ['error' => 'Un autre cours existe deja pour cette classe sur ce creneau', 'code' => 'CLASS_SLOT_CONFLICT', 'conflict' => true];
        }

        $teacherConflict = $this->findTeacherConflict($pdo, $payload);
        if ($teacherConflict) {
            return ['error' => $this->teacherConflictMessage($teacherConflict), 'code' => 'TEACHER_SLOT_CONFLICT', 'conflict' => true];
        }

        $workloadError = $this->validateWorkloadLimits($pdo, $payload);
        if ($workloadError !== null) {
            return ['error' => $workloadError['message'], 'code' => $workloadError['code'], 'conflict' => true];
        }

        if (!$isExternal && !empty($payload['weekly_hours'])) {
            (new SubjectService())->updateWeeklyHours((int)$payload['subject_id'], (int)$payload['class_level_id'], (int)$payload['weekly_hours']);
        }

        try {
            $stmt = $pdo->prepare('
                INSERT INTO schedules (
                    school_id, class_level_id, subject_id, subject, teacher_id, teacher_name, room, is_external, schedule_type, year_value, week_number, day_of_week, day_order,
                    start_time, end_time, notes, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([
                $payload['school_id'],
                $payload['class_level_id'],
                $payload['subject_id'],
                $payload['subject'],
                $payload['teacher_id'],
                $payload['teacher_name'],
                $payload['room'],
                $payload['is_external'],
                $payload['schedule_type'],
                $payload['year_value'],
                $payload['week_number'],
                $payload['day_of_week'],
                $payload['day_order'],
                $payload['start_time'],
                $payload['end_time'],
                $payload['notes'],
                $payload['status'],
            ]);
        } catch (PDOException $e) {
            return ['error' => $this->databaseErrorMessage($e)];
        }

        if (!$isExternal) {
            $this->syncTeacherAssignment($pdo, $payload);
        }

        return [
            'id' => (int)$pdo->lastInsertId(),
            'message' => 'Schedule created successfully',
        ];
    }

    public function update(int $scheduleId, array $data): array
    {
        $existing = $this->getById($scheduleId);
        if (!$existing) {
            return ['error' => 'Schedule not found'];
        }

        $pdo = Database::connect();
        [$role, $schoolId] = $this->authScope();

        if ($role !== 'super_admin' && (int)$existing['school_id'] !== $schoolId) {
            return ['error' => 'Forbidden'];
        }

        $data = array_merge($existing, $data);
        $isExternal = $this->isExternal($data);
        $classLevel = null;
        if (!$isExternal) {
            $classLevel = $this->resolveClassLevel($pdo, $data, $role, $schoolId);
            if (isset($classLevel['error'])) {
                return $classLevel;
            }
        }

        $payload = $this->validatedPayload($pdo, $data, $classLevel, $role, $schoolId);
        if (isset($payload['error'])) {
            return $payload;
        }
        $payload['id'] = $scheduleId;

        $conflict = $this->findConflict($pdo, $payload, $scheduleId);
        if ($conflict) {
            return ['error' => 'Un autre cours existe deja pour cette classe sur ce creneau', 'code' => 'CLASS_SLOT_CONFLICT', 'conflict' => true];
        }

        $teacherConflict = $this->findTeacherConflict($pdo, $payload, $scheduleId);
        if ($teacherConflict) {
            return ['error' => $this->teacherConflictMessage($teacherConflict), 'code' => 'TEACHER_SLOT_CONFLICT', 'conflict' => true];
        }

        $workloadError = $this->validateWorkloadLimits($pdo, $payload, $scheduleId);
        if ($workloadError !== null) {
            return ['error' => $workloadError['message'], 'code' => $workloadError['code'], 'conflict' => true];
        }

        if (!$isExternal && !empty($payload['weekly_hours'])) {
            (new SubjectService())->updateWeeklyHours((int)$payload['subject_id'], (int)$payload['class_level_id'], (int)$payload['weekly_hours']);
        }

        try {
            $stmt = $pdo->prepare('
                UPDATE schedules
                SET
                    class_level_id = ?,
                    subject_id = ?,
                    subject = ?,
                    teacher_id = ?,
                    teacher_name = ?,
                    room = ?,
                    is_external = ?,
                    schedule_type = ?,
                    year_value = ?,
                    week_number = ?,
                    day_of_week = ?,
                    day_order = ?,
                    start_time = ?,
                    end_time = ?,
                    notes = ?,
                    status = ?
                WHERE id = ?
            ');
            $stmt->execute([
                $payload['class_level_id'],
                $payload['subject_id'],
                $payload['subject'],
                $payload['teacher_id'],
                $payload['teacher_name'],
                $payload['room'],
                $payload['is_external'],
                $payload['schedule_type'],
                $payload['year_value'],
                $payload['week_number'],
                $payload['day_of_week'],
                $payload['day_order'],
                $payload['start_time'],
                $payload['end_time'],
                $payload['notes'],
                $payload['status'],
                $scheduleId,
            ]);
        } catch (PDOException $e) {
            return ['error' => $this->databaseErrorMessage($e)];
        }

        if (!$isExternal) {
            $this->syncTeacherAssignment($pdo, $payload);
        }

        return [
            'id' => $scheduleId,
            'message' => 'Schedule updated successfully',
        ];
    }

    public function delete(int $scheduleId): array
    {
        $existing = $this->getById($scheduleId);
        if (!$existing) {
            return ['error' => 'Schedule not found'];
        }

        $pdo = Database::connect();
        $stmt = $pdo->prepare('DELETE FROM schedules WHERE id = ?');
        $stmt->execute([$scheduleId]);

        return [
            'id' => $scheduleId,
            'message' => 'Schedule deleted successfully',
        ];
    }

    public function move(int $scheduleId, array $data): array
    {
        $existing = $this->getById($scheduleId);
        if (!$existing) {
            return ['error' => 'Schedule not found'];
        }

        $weeklyHours = (int)($existing['subject_weekly_hours'] ?? 0);
        if ((int)($existing['is_external'] ?? 0) === 0 && $weeklyHours <= 0) {
            $stmt = Database::connect()->prepare('
                SELECT CEIL(COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600, 1))
                FROM schedules
                WHERE school_id = ? AND class_level_id = ? AND subject_id = ?
                  AND year_value = ? AND week_number = ? AND status = "ACTIVE" AND is_external = 0
            ');
            $stmt->execute([
                $existing['school_id'],
                $existing['class_level_id'],
                $existing['subject_id'],
                $existing['year_value'],
                $existing['week_number'],
            ]);
            $weeklyHours = max(1, (int)$stmt->fetchColumn());
        }

        return $this->update($scheduleId, [
            'year_value' => $data['year_value'] ?? $existing['year_value'],
            'week_number' => $data['week_number'] ?? $existing['week_number'],
            'day_of_week' => $data['day_of_week'] ?? $existing['day_of_week'],
            'start_time' => $data['start_time'] ?? $existing['start_time'],
            'end_time' => $data['end_time'] ?? $existing['end_time'],
            'weekly_hours' => $weeklyHours,
        ]);
    }

    private function validatedPayload(PDO $pdo, array $data, ?array $classLevel, string $role, ?int $actorSchoolId): array
    {
        $isExternal = $this->isExternal($data);
        $schoolId = $classLevel !== null ? (int)$classLevel['school_id'] : $actorSchoolId;
        if ($role === 'super_admin' && $isExternal) {
            $schoolId = isset($data['school_id']) ? (int)$data['school_id'] : $schoolId;
        }

        if (!$schoolId || $schoolId <= 0) {
            return ['error' => 'Ecole obligatoire pour ce creneau'];
        }

        $subjectId = isset($data['subject_id']) ? (int)$data['subject_id'] : 0;
        $subject = false;
        $weeklyHours = isset($data['weekly_hours']) ? (int)$data['weekly_hours'] : 0;
        if (!$isExternal) {
            if ($classLevel === null) {
                return ['error' => 'La classe est obligatoire'];
            }

            $subject = (new SubjectService())->validateSubjectForClassLevel($subjectId, (int)$classLevel['id']);
            if (!$subject) {
                return ['error' => 'Cette matiere n est pas autorisee pour ce niveau scolaire'];
            }

            if ($weeklyHours <= 0 || $weeklyHours > 40) {
                return ['error' => 'Nombre d heures par semaine obligatoire pour cette matiere'];
            }
        }

        $teacherId = isset($data['teacher_id']) ? (int)$data['teacher_id'] : 0;
        $teacherName = trim((string)($data['teacher_name'] ?? ''));
        if ($teacherId > 0) {
            $teacher = $this->resolveTeacher($pdo, $teacherId, $schoolId);
            if (!$teacher) {
                return ['error' => 'Professeur introuvable pour cette ecole'];
            }
            if (!$isExternal && !$this->teacherAllowsClassLevel($pdo, $teacherId, (int)$classLevel['id'])) {
                return ['error' => 'Ce professeur n enseigne pas ce niveau'];
            }
            if (!$isExternal && !$this->teacherAllowsSubject($pdo, $teacherId, (int)$subject['id'])) {
                return ['error' => 'Ce professeur n enseigne pas cette matiere'];
            }
            $teacherName = trim((string)$teacher['first_name'] . ' ' . (string)$teacher['last_name']);
        }

        if ($teacherName === '') {
            return ['error' => 'Le nom du professeur est obligatoire'];
        }

        $day = strtoupper(trim((string)($data['day_of_week'] ?? '')));
        if (!in_array($day, self::DAYS, true)) {
            return ['error' => 'Jour invalide'];
        }

        $startTime = $this->normalizeTime($data['start_time'] ?? null);
        $endTime = $this->normalizeTime($data['end_time'] ?? null);
        if (!$startTime || !$endTime) {
            return ['error' => 'Heure de debut et heure de fin sont obligatoires'];
        }

        if ($startTime >= $endTime) {
            return ['error' => 'Heure de fin doit etre apres heure de debut'];
        }

        $status = strtoupper(trim((string)($data['status'] ?? 'ACTIVE')));
        if (!in_array($status, ['ACTIVE', 'CANCELLED'], true)) {
            return ['error' => 'Statut invalide'];
        }

        $yearValue = isset($data['year_value']) ? (int)$data['year_value'] : 0;
        if ($yearValue < 2000 || $yearValue > 2100) {
            return ['error' => 'Annee invalide pour la semaine'];
        }

        $weekNumber = isset($data['week_number']) ? (int)$data['week_number'] : 0;
        if ($weekNumber < 1 || $weekNumber > 53) {
            return ['error' => 'Numero de semaine invalide'];
        }

        return [
            'school_id' => $schoolId,
            'class_level_id' => $isExternal ? null : (int)$classLevel['id'],
            'subject_id' => $isExternal ? null : (int)$subject['id'],
            'weekly_hours' => $isExternal ? 0 : $weeklyHours,
            'subject' => $isExternal ? 'Ailleurs' : (string)$subject['name'],
            'teacher_id' => $teacherId > 0 ? $teacherId : null,
            'teacher_name' => $teacherName,
            'room' => $this->nullable($data['room'] ?? null),
            'is_external' => $isExternal ? 1 : 0,
            'schedule_type' => $isExternal ? 'external_busy' : 'eduflow_course',
            'year_value' => $yearValue,
            'week_number' => $weekNumber,
            'day_of_week' => $day,
            'day_order' => array_search($day, self::DAYS, true) + 1,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'notes' => $this->nullable($data['notes'] ?? null),
            'status' => $status,
        ];
    }

    private function resolveClassLevel(PDO $pdo, array $data, string $role, ?int $actorSchoolId): array
    {
        $classLevelId = isset($data['class_level_id']) ? (int)$data['class_level_id'] : 0;
        if ($classLevelId <= 0) {
            return ['error' => 'La classe est obligatoire'];
        }

        $sql = 'SELECT id, school_id, name FROM class_levels WHERE id = ?';
        $params = [$classLevelId];

        if ($role !== 'super_admin') {
            $sql .= ' AND school_id = ?';
            $params[] = $actorSchoolId;
        }

        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        $classLevel = $stmt->fetch();

        if (!$classLevel) {
            return ['error' => 'Classe introuvable'];
        }

        return $classLevel;
    }

    private function findConflict(PDO $pdo, array $payload, ?int $ignoreId = null): array|false
    {
        if ($payload['status'] !== 'ACTIVE' || empty($payload['class_level_id'])) {
            return false;
        }

        $sql = '
            SELECT id
            FROM schedules
            WHERE school_id = ?
              AND class_level_id = ?
              AND year_value = ?
              AND week_number = ?
              AND day_of_week = ?
              AND status = "ACTIVE"
              AND start_time < ?
              AND end_time > ?
        ';
        $params = [
            $payload['school_id'],
            $payload['class_level_id'],
            $payload['year_value'],
            $payload['week_number'],
            $payload['day_of_week'],
            $payload['end_time'],
            $payload['start_time'],
        ];

        if ($ignoreId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $ignoreId;
        }

        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return $stmt->fetch() ?: false;
    }

    private function validateWorkloadLimits(PDO $pdo, array $payload, ?int $ignoreId = null): ?array
    {
        if (
            $payload['status'] !== 'ACTIVE'
            || (int)$payload['is_external'] === 1
            || empty($payload['teacher_id'])
            || empty($payload['class_level_id'])
            || empty($payload['subject_id'])
        ) {
            return null;
        }

        $durationHours = (strtotime((string)$payload['end_time']) - strtotime((string)$payload['start_time'])) / 3600;
        if ($durationHours <= 0) {
            return ['code' => 'INVALID_COURSE_DURATION', 'message' => 'La duree du cours est invalide'];
        }

        $classSql = '
            SELECT COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600, 0)
            FROM schedules
            WHERE school_id = ? AND class_level_id = ? AND subject_id = ?
              AND year_value = ? AND week_number = ? AND status = "ACTIVE" AND is_external = 0
        ';
        $classParams = [
            $payload['school_id'],
            $payload['class_level_id'],
            $payload['subject_id'],
            $payload['year_value'],
            $payload['week_number'],
        ];
        if ($ignoreId !== null) {
            $classSql .= ' AND id != ?';
            $classParams[] = $ignoreId;
        }
        $classStmt = $pdo->prepare($classSql);
        $classStmt->execute($classParams);
        $classScheduledHours = (float)$classStmt->fetchColumn();
        if ($classScheduledHours + $durationHours > (float)$payload['weekly_hours'] + 0.001) {
            return [
                'code' => 'SUBJECT_WEEKLY_HOURS_EXCEEDED',
                'message' => sprintf(
                    'La charge de cette matiere dans cette classe depasse %.2f h par semaine',
                    (float)$payload['weekly_hours']
                ),
            ];
        }

        $assignmentStmt = $pdo->prepare('
            SELECT COALESCE(SUM(ta.weekly_hours), 0) AS total_hours,
                   MAX(CASE WHEN ta.subject_id = ? AND ta.class_level_id = ? THEN ta.weekly_hours ELSE NULL END) AS current_hours
            FROM teacher_assignments ta
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            WHERE ta.school_id = ? AND ta.teacher_id = ? AND ta.status = "ACTIVE"
              AND YEAR(ay.start_date) = ?
        ');
        $assignmentStmt->execute([
            $payload['subject_id'],
            $payload['class_level_id'],
            $payload['school_id'],
            $payload['teacher_id'],
            $payload['year_value'],
        ]);
        $assignment = $assignmentStmt->fetch() ?: [];
        $assignedHours = (float)($assignment['total_hours'] ?? 0);
        $currentAssignmentHours = $assignment['current_hours'] === null ? null : (float)$assignment['current_hours'];
        $expectedAssignedHours = $currentAssignmentHours === null
            ? $assignedHours + (float)$payload['weekly_hours']
            : $assignedHours - $currentAssignmentHours + (float)$payload['weekly_hours'];

        $teacherSql = '
            SELECT COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600, 0)
            FROM schedules
            WHERE school_id = ? AND teacher_id = ? AND year_value = ? AND week_number = ?
              AND status = "ACTIVE" AND is_external = 0
        ';
        $teacherParams = [
            $payload['school_id'],
            $payload['teacher_id'],
            $payload['year_value'],
            $payload['week_number'],
        ];
        if ($ignoreId !== null) {
            $teacherSql .= ' AND id != ?';
            $teacherParams[] = $ignoreId;
        }
        $teacherStmt = $pdo->prepare($teacherSql);
        $teacherStmt->execute($teacherParams);
        $teacherScheduledHours = (float)$teacherStmt->fetchColumn();
        if ($expectedAssignedHours > 0 && $teacherScheduledHours + $durationHours > $expectedAssignedHours + 0.001) {
            return [
                'code' => 'TEACHER_WEEKLY_HOURS_EXCEEDED',
                'message' => sprintf(
                    'La charge planifiee de ce professeur depasse sa charge affectee de %.2f h par semaine',
                    $expectedAssignedHours
                ),
            ];
        }

        return null;
    }

    private function syncTeacherAssignment(PDO $pdo, array $payload): void
    {
        if (empty($payload['teacher_id']) || empty($payload['subject_id']) || empty($payload['class_level_id'])) {
            return;
        }

        $yearStmt = $pdo->prepare('
            SELECT id
            FROM academic_years
            WHERE school_id = ? AND YEAR(start_date) = ?
            ORDER BY is_current DESC, id DESC
            LIMIT 1
        ');
        $yearStmt->execute([$payload['school_id'], $payload['year_value']]);
        $academicYearId = (int)$yearStmt->fetchColumn();
        if ($academicYearId <= 0) {
            return;
        }

        $stmt = $pdo->prepare('
            INSERT INTO teacher_assignments (
                school_id, academic_year_id, teacher_id, subject_id, class_level_id, weekly_hours, status
            ) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")
            ON DUPLICATE KEY UPDATE weekly_hours = VALUES(weekly_hours), status = "ACTIVE"
        ');
        $stmt->execute([
            $payload['school_id'],
            $academicYearId,
            $payload['teacher_id'],
            $payload['subject_id'],
            $payload['class_level_id'],
            $payload['weekly_hours'],
        ]);
    }

    private function decorateSubjectSessions(array $rows): array
    {
        $counters = [];

        foreach ($rows as &$row) {
            $row['subject_session_number'] = null;
            $row['subject_weekly_hours'] = isset($row['subject_weekly_hours']) ? (int)$row['subject_weekly_hours'] : 0;

            if ((int)($row['is_external'] ?? 0) === 1 || empty($row['class_level_id']) || empty($row['subject_id'])) {
                continue;
            }

            $key = implode(':', [
                (string)($row['school_id'] ?? ''),
                (string)($row['class_level_id'] ?? ''),
                (string)($row['subject_id'] ?? ''),
                (string)($row['year_value'] ?? ''),
                (string)($row['week_number'] ?? ''),
            ]);
            $counters[$key] = ($counters[$key] ?? 0) + 1;
            $row['subject_session_number'] = $counters[$key];
        }

        unset($row);
        return $rows;
    }

    private function findTeacherConflict(PDO $pdo, array $payload, ?int $ignoreId = null): array|false
    {
        if ($payload['status'] !== 'ACTIVE' || trim((string)$payload['teacher_name']) === '') {
            return false;
        }

        $sql = '
            SELECT sc.id, sc.subject, sc.teacher_id, sc.teacher_name, sc.is_external, sc.schedule_type, sc.notes, sc.year_value, sc.week_number, sc.day_of_week, sc.start_time, sc.end_time, u.gender AS teacher_gender, COALESCE(cl.name, cl.group_name, "Ailleurs") AS class_level_name
            FROM schedules sc
            LEFT JOIN class_levels cl ON cl.id = sc.class_level_id
            LEFT JOIN users u ON u.id = sc.teacher_id
            WHERE sc.school_id = ?
              AND sc.year_value = ?
              AND sc.week_number = ?
              AND sc.day_of_week = ?
              AND sc.status = "ACTIVE"
              AND sc.start_time < ?
              AND sc.end_time > ?
        ';
        $params = [
            $payload['school_id'],
            $payload['year_value'],
            $payload['week_number'],
            $payload['day_of_week'],
            $payload['end_time'],
            $payload['start_time']
        ];

        if (!empty($payload['teacher_id'])) {
            $sql .= ' AND (sc.teacher_id = ? OR LOWER(TRIM(sc.teacher_name)) = ?)';
            $params[] = $payload['teacher_id'];
            $params[] = strtolower(trim((string)$payload['teacher_name']));
        } else {
            $sql .= ' AND LOWER(TRIM(sc.teacher_name)) = ?';
            $params[] = strtolower(trim((string)$payload['teacher_name']));
        }

        if ($ignoreId !== null) {
            $sql .= ' AND sc.id != ?';
            $params[] = $ignoreId;
        }

        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return $stmt->fetch() ?: false;
    }

    private function teacherConflictMessage(array $conflict): string
    {
        $teacher = (string)($conflict['teacher_name'] ?? 'ce professeur');
        $gender = strtoupper((string)($conflict['teacher_gender'] ?? ''));
        $displayName = $gender === 'FEMALE' ? "Mme {$teacher}" : ($gender === 'MALE' ? "M. {$teacher}" : "Ce professeur");

        if ((int)($conflict['is_external'] ?? 0) === 1) {
            $subject = $gender === 'FEMALE' ? 'Elle' : ($gender === 'MALE' ? 'Il' : 'Il/elle');
            $busy = $gender === 'FEMALE' ? 'occupée' : 'occupé';
            return "{$displayName} n'est pas disponible sur ce créneau. {$subject} est {$busy} dans un autre établissement.";
        }

        return "Ce professeur possède déjà un cours sur ce créneau.";
    }

    private function dayLabel(string $day): string
    {
        return [
            'MONDAY' => 'lundi',
            'TUESDAY' => 'mardi',
            'WEDNESDAY' => 'mercredi',
            'THURSDAY' => 'jeudi',
            'FRIDAY' => 'vendredi',
            'SATURDAY' => 'samedi',
            'SUNDAY' => 'dimanche',
        ][$day] ?? 'ce jour';
    }

    private function normalizeTime(mixed $time): ?string
    {
        $value = trim((string)$time);
        if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $value)) {
            return null;
        }

        $parts = explode(':', $value);
        $hour = (int)$parts[0];
        $minute = (int)$parts[1];
        if ($hour > 23 || $minute > 59) {
            return null;
        }

        return sprintf('%02d:%02d:00', $hour, $minute);
    }

    private function authScope(): array
    {
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;
        return [$role, $schoolId];
    }

    private function nullable(mixed $value): ?string
    {
        $str = trim((string)$value);
        return $str === '' ? null : $str;
    }

    private function isExternal(array $data): bool
    {
        $value = $data['is_external'] ?? false;
        return $value === true || $value === 1 || $value === '1' || strtolower((string)$value) === 'true';
    }

    private function resolveTeacher(PDO $pdo, int $teacherId, int $schoolId): array|false
    {
        if ($teacherId <= 0) {
            return false;
        }

        $stmt = $pdo->prepare('
            SELECT id, first_name, last_name
            FROM users
            WHERE id = ?
              AND school_id = ?
              AND status = "ACTIVE"
              AND role = "professeur"
            LIMIT 1
        ');
        $stmt->execute([$teacherId, $schoolId]);
        return $stmt->fetch() ?: false;
    }

    private function teacherAllowsClassLevel(PDO $pdo, int $teacherId, int $classLevelId): bool
    {
        try {
            $total = $pdo->prepare('SELECT COUNT(*) AS total FROM teacher_class_levels WHERE teacher_id = ?');
            $total->execute([$teacherId]);
            if ((int)$total->fetchColumn() === 0) {
                return false;
            }

            $stmt = $pdo->prepare('SELECT 1 FROM teacher_class_levels WHERE teacher_id = ? AND class_level_id = ? LIMIT 1');
            $stmt->execute([$teacherId, $classLevelId]);
            return (bool)$stmt->fetchColumn();
        } catch (PDOException) {
            return true;
        }
    }

    private function teacherAllowsSubject(PDO $pdo, int $teacherId, int $subjectId): bool
    {
        try {
            $total = $pdo->prepare('SELECT COUNT(*) AS total FROM teacher_subjects WHERE teacher_id = ?');
            $total->execute([$teacherId]);
            if ((int)$total->fetchColumn() === 0) {
                return false;
            }

            $stmt = $pdo->prepare('SELECT 1 FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ? LIMIT 1');
            $stmt->execute([$teacherId, $subjectId]);
            return (bool)$stmt->fetchColumn();
        } catch (PDOException) {
            return true;
        }
    }

    private function databaseErrorMessage(PDOException $e): string
    {
        $driverCode = (int)($e->errorInfo[1] ?? 0);
        if ($driverCode === 1146) {
            return 'Table schedules absente. Lancez la migration 2026_08_27_create_schedules_table.sql.';
        }
        if ($driverCode === 1054) {
            return 'Structure de base de données incomplète. Lancez les migrations de l emploi du temps.';
        }

        return 'Impossible d enregistrer ce créneau.';
    }
}
