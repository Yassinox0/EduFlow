<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use PDOException;

class TeacherAssignmentService
{
    private const STATUSES = ['ACTIVE', 'INACTIVE'];

    public function getAll(array $filters = []): array
    {
        $authUser = Request::get('auth_user', []);
        $schoolId = (int)($authUser['school_id'] ?? 0);
        $role = (string)($authUser['role'] ?? '');
        $conditions = ['ta.school_id = ?'];
        $parameters = [$schoolId];

        foreach (['academic_year_id', 'teacher_id', 'subject_id', 'class_level_id'] as $field) {
            $value = (int)($filters[$field] ?? 0);
            if ($value > 0) {
                $conditions[] = 'ta.' . $field . ' = ?';
                $parameters[] = $value;
            }
        }

        $status = strtoupper(trim((string)($filters['status'] ?? '')));
        if (in_array($status, self::STATUSES, true)) {
            $conditions[] = 'ta.status = ?';
            $parameters[] = $status;
        }

        if ($role === 'professeur') {
            $conditions[] = 'ta.teacher_id = ?';
            $parameters[] = (int)($authUser['id'] ?? 0);
        }

        $stmt = Database::connect()->prepare('
            SELECT
                ta.id,
                ta.school_id,
                ta.academic_year_id,
                ay.name AS academic_year_name,
                ay.is_current AS academic_year_is_current,
                ta.teacher_id,
                CONCAT_WS(" ", teacher.first_name, teacher.last_name) AS teacher_name,
                teacher.email AS teacher_email,
                ta.subject_id,
                subject.name AS subject_name,
                subject.code AS subject_code,
                ta.class_level_id,
                class_level.name AS class_name,
                class_level.level_name,
                class_level.group_name,
                ta.weekly_hours,
                ta.status,
                ta.created_at,
                ta.updated_at
            FROM teacher_assignments ta
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            INNER JOIN users teacher ON teacher.id = ta.teacher_id
            INNER JOIN subjects subject ON subject.id = ta.subject_id
            INNER JOIN class_levels class_level ON class_level.id = ta.class_level_id
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY ay.is_current DESC, teacher.last_name ASC, teacher.first_name ASC,
                     class_level.sort_order ASC, subject.sort_order ASC
        ');
        $stmt->execute($parameters);

        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connect();
        $payload = $this->validatedPayload($pdo, $data);
        if (isset($payload['error'])) {
            return $payload;
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('
                INSERT INTO teacher_assignments (
                    school_id, academic_year_id, teacher_id, subject_id,
                    class_level_id, weekly_hours, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([
                $payload['school_id'],
                $payload['academic_year_id'],
                $payload['teacher_id'],
                $payload['subject_id'],
                $payload['class_level_id'],
                $payload['weekly_hours'],
                $payload['status'],
            ]);
            $id = (int)$pdo->lastInsertId();
            $this->syncLegacyMappings($pdo, $payload);
            $pdo->commit();

            return $this->find($id) + ['message' => 'Teacher assignment created successfully'];
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
                return ['error' => 'Teacher assignment already exists'];
            }
            return ['error' => 'Teacher assignment creation failed'];
        }
    }

    public function update(int $id, array $data): array
    {
        $pdo = Database::connect();
        $existing = $this->find($id);
        if (!$existing) {
            return ['error' => 'Teacher assignment not found'];
        }

        $payload = $this->validatedPayload($pdo, [
            'academic_year_id' => $data['academic_year_id'] ?? $existing['academic_year_id'],
            'teacher_id' => $data['teacher_id'] ?? $existing['teacher_id'],
            'subject_id' => $data['subject_id'] ?? $existing['subject_id'],
            'class_level_id' => $data['class_level_id'] ?? $existing['class_level_id'],
            'weekly_hours' => $data['weekly_hours'] ?? $existing['weekly_hours'],
            'status' => $data['status'] ?? $existing['status'],
        ]);
        if (isset($payload['error'])) {
            return $payload;
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('
                UPDATE teacher_assignments
                SET academic_year_id = ?, teacher_id = ?, subject_id = ?, class_level_id = ?,
                    weekly_hours = ?, status = ?
                WHERE id = ? AND school_id = ?
            ');
            $stmt->execute([
                $payload['academic_year_id'],
                $payload['teacher_id'],
                $payload['subject_id'],
                $payload['class_level_id'],
                $payload['weekly_hours'],
                $payload['status'],
                $id,
                $payload['school_id'],
            ]);
            $this->syncLegacyMappings($pdo, $payload);
            $pdo->commit();

            return $this->find($id) + ['message' => 'Teacher assignment updated successfully'];
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
                return ['error' => 'Teacher assignment already exists'];
            }
            return ['error' => 'Teacher assignment update failed'];
        }
    }

    public function deactivate(int $id): array
    {
        $assignment = $this->find($id);
        if (!$assignment) {
            return ['error' => 'Teacher assignment not found'];
        }

        $stmt = Database::connect()->prepare('
            UPDATE teacher_assignments
            SET status = "INACTIVE"
            WHERE id = ? AND school_id = ?
        ');
        $stmt->execute([$id, $this->schoolId()]);

        return ['id' => $id, 'status' => 'INACTIVE', 'message' => 'Teacher assignment deactivated successfully'];
    }

    private function validatedPayload(PDO $pdo, array $data): array
    {
        $schoolId = $this->schoolId();
        $academicYearId = (int)($data['academic_year_id'] ?? 0);
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $subjectId = (int)($data['subject_id'] ?? 0);
        $classLevelId = (int)($data['class_level_id'] ?? 0);
        $weeklyHours = (int)($data['weekly_hours'] ?? 0);
        $status = strtoupper(trim((string)($data['status'] ?? 'ACTIVE')));

        if ($academicYearId <= 0 || $teacherId <= 0 || $subjectId <= 0 || $classLevelId <= 0) {
            return ['error' => 'academic_year_id, teacher_id, subject_id and class_level_id are required'];
        }
        if ($weeklyHours < 0 || $weeklyHours > 60) {
            return ['error' => 'weekly_hours must be between 0 and 60'];
        }
        if (!in_array($status, self::STATUSES, true)) {
            return ['error' => 'Invalid teacher assignment status'];
        }

        $academicYear = $this->schoolEntity($pdo, 'academic_years', $academicYearId, $schoolId);
        if (!$academicYear) {
            return ['error' => 'Academic year not found for this school'];
        }
        $classLevel = $this->schoolEntity($pdo, 'class_levels', $classLevelId, $schoolId);
        if (!$classLevel) {
            return ['error' => 'Class level not found for this school'];
        }

        $teacherStmt = $pdo->prepare('
            SELECT id, school_id, role, status
            FROM users
            WHERE id = ? AND school_id = ? AND role = "professeur" AND status = "ACTIVE"
            LIMIT 1
        ');
        $teacherStmt->execute([$teacherId, $schoolId]);
        if (!$teacherStmt->fetch()) {
            return ['error' => 'Active professor not found for this school'];
        }

        $subjectStmt = $pdo->prepare('SELECT id FROM subjects WHERE id = ? AND status = "ACTIVE" LIMIT 1');
        $subjectStmt->execute([$subjectId]);
        if (!$subjectStmt->fetch()) {
            return ['error' => 'Active subject not found'];
        }

        return [
            'school_id' => $schoolId,
            'academic_year_id' => $academicYearId,
            'teacher_id' => $teacherId,
            'subject_id' => $subjectId,
            'class_level_id' => $classLevelId,
            'weekly_hours' => $weeklyHours,
            'status' => $status,
        ];
    }

    private function syncLegacyMappings(PDO $pdo, array $payload): void
    {
        $pdo->prepare('
            INSERT IGNORE INTO teacher_class_levels (teacher_id, class_level_id)
            VALUES (?, ?)
        ')->execute([$payload['teacher_id'], $payload['class_level_id']]);

        $pdo->prepare('
            INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
            VALUES (?, ?)
        ')->execute([$payload['teacher_id'], $payload['subject_id']]);
    }

    private function schoolEntity(PDO $pdo, string $table, int $id, int $schoolId): array|false
    {
        if (!in_array($table, ['academic_years', 'class_levels'], true)) {
            return false;
        }

        $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? AND school_id = ? LIMIT 1");
        $stmt->execute([$id, $schoolId]);
        return $stmt->fetch() ?: false;
    }

    private function find(int $id): array|false
    {
        $stmt = Database::connect()->prepare('
            SELECT ta.*, ay.name AS academic_year_name,
                   CONCAT_WS(" ", teacher.first_name, teacher.last_name) AS teacher_name,
                   teacher.email AS teacher_email,
                   subject.name AS subject_name, subject.code AS subject_code,
                   class_level.name AS class_name, class_level.level_name, class_level.group_name
            FROM teacher_assignments ta
            INNER JOIN academic_years ay ON ay.id = ta.academic_year_id
            INNER JOIN users teacher ON teacher.id = ta.teacher_id
            INNER JOIN subjects subject ON subject.id = ta.subject_id
            INNER JOIN class_levels class_level ON class_level.id = ta.class_level_id
            WHERE ta.id = ? AND ta.school_id = ?
            LIMIT 1
        ');
        $stmt->execute([$id, $this->schoolId()]);
        return $stmt->fetch() ?: false;
    }

    private function schoolId(): int
    {
        return (int)(Request::get('auth_user', [])['school_id'] ?? 0);
    }
}
