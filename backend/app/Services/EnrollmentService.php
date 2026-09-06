<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use PDOException;

class EnrollmentService
{
    private const STATUSES = ['ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED'];

    public function getAll(array $filters = []): array
    {
        $authUser = Request::get('auth_user', []);
        $schoolId = (int)($authUser['school_id'] ?? 0);
        $role = (string)($authUser['role'] ?? '');
        $actorId = (int)($authUser['id'] ?? 0);
        $conditions = ['e.school_id = ?'];
        $parameters = [$schoolId];

        foreach (['academic_year_id', 'class_level_id', 'student_id'] as $field) {
            $value = (int)($filters[$field] ?? 0);
            if ($value > 0) {
                $conditions[] = 'e.' . $field . ' = ?';
                $parameters[] = $value;
            }
        }

        $status = strtoupper(trim((string)($filters['status'] ?? '')));
        if (in_array($status, self::STATUSES, true)) {
            $conditions[] = 'e.status = ?';
            $parameters[] = $status;
        }

        if ($role === 'professeur') {
            $conditions[] = '
                EXISTS (
                    SELECT 1
                    FROM teacher_assignments ta
                    WHERE ta.school_id = e.school_id
                      AND ta.academic_year_id = e.academic_year_id
                      AND ta.class_level_id = e.class_level_id
                      AND ta.teacher_id = ?
                      AND ta.status = "ACTIVE"
                )
            ';
            $parameters[] = $actorId;
        }

        $sql = '
            SELECT
                e.id,
                e.school_id,
                e.academic_year_id,
                ay.name AS academic_year_name,
                ay.is_current AS academic_year_is_current,
                e.student_id,
                s.first_name,
                s.last_name,
                s.parent_id,
                COALESCE(NULLIF(s.parent_name, ""), CONCAT_WS(" ", p.first_name, p.last_name)) AS parent_name,
                e.class_level_id,
                cl.name AS class_name,
                cl.level_name,
                cl.group_name,
                e.enrollment_date,
                e.status,
                e.created_at,
                e.updated_at
            FROM enrollments e
            INNER JOIN academic_years ay ON ay.id = e.academic_year_id
            INNER JOIN students s ON s.id = e.student_id
            INNER JOIN class_levels cl ON cl.id = e.class_level_id
            LEFT JOIN parents p ON p.id = s.parent_id
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY ay.is_current DESC, cl.sort_order ASC, s.last_name ASC, s.first_name ASC
        ';

        $stmt = Database::connect()->prepare($sql);
        $stmt->execute($parameters);

        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connect();
        $schoolId = $this->schoolId();
        $academicYearId = (int)($data['academic_year_id'] ?? 0);
        $studentId = (int)($data['student_id'] ?? 0);
        $classLevelId = (int)($data['class_level_id'] ?? 0);
        $enrollmentDate = trim((string)($data['enrollment_date'] ?? date('Y-m-d')));
        $status = strtoupper(trim((string)($data['status'] ?? 'ACTIVE')));

        $validation = $this->validatePayload(
            $pdo,
            $schoolId,
            $academicYearId,
            $studentId,
            $classLevelId,
            $enrollmentDate,
            $status
        );
        if (isset($validation['error'])) {
            return $validation;
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('
                INSERT INTO enrollments (
                    school_id, academic_year_id, student_id, class_level_id, enrollment_date, status
                ) VALUES (?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([$schoolId, $academicYearId, $studentId, $classLevelId, $enrollmentDate, $status]);
            $id = (int)$pdo->lastInsertId();

            if ($status === 'ACTIVE' && (bool)$validation['academic_year']['is_current']) {
                $this->syncCurrentStudent($pdo, $studentId, $schoolId, $validation['academic_year'], $validation['class_level']);
            }

            $pdo->commit();
            return $this->find($id) + ['message' => 'Enrollment created successfully'];
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
                return ['error' => 'Student is already enrolled for this academic year'];
            }
            return ['error' => 'Enrollment creation failed'];
        }
    }

    public function update(int $id, array $data): array
    {
        $pdo = Database::connect();
        $schoolId = $this->schoolId();
        $existing = $this->find($id);

        if (!$existing) {
            return ['error' => 'Enrollment not found'];
        }

        $academicYearId = (int)$existing['academic_year_id'];
        $studentId = (int)$existing['student_id'];
        $classLevelId = array_key_exists('class_level_id', $data)
            ? (int)$data['class_level_id']
            : (int)$existing['class_level_id'];
        $enrollmentDate = array_key_exists('enrollment_date', $data)
            ? trim((string)$data['enrollment_date'])
            : (string)$existing['enrollment_date'];
        $status = array_key_exists('status', $data)
            ? strtoupper(trim((string)$data['status']))
            : (string)$existing['status'];

        $validation = $this->validatePayload(
            $pdo,
            $schoolId,
            $academicYearId,
            $studentId,
            $classLevelId,
            $enrollmentDate,
            $status
        );
        if (isset($validation['error'])) {
            return $validation;
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('
                UPDATE enrollments
                SET class_level_id = ?, enrollment_date = ?, status = ?
                WHERE id = ? AND school_id = ?
            ');
            $stmt->execute([$classLevelId, $enrollmentDate, $status, $id, $schoolId]);

            if ($status === 'ACTIVE' && (bool)$validation['academic_year']['is_current']) {
                $this->syncCurrentStudent($pdo, $studentId, $schoolId, $validation['academic_year'], $validation['class_level']);
            }

            $pdo->commit();
            return $this->find($id) + ['message' => 'Enrollment updated successfully'];
        } catch (PDOException) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return ['error' => 'Enrollment update failed'];
        }
    }

    private function validatePayload(
        PDO $pdo,
        int $schoolId,
        int $academicYearId,
        int $studentId,
        int $classLevelId,
        string $enrollmentDate,
        string $status
    ): array {
        if ($academicYearId <= 0 || $studentId <= 0 || $classLevelId <= 0) {
            return ['error' => 'academic_year_id, student_id and class_level_id are required'];
        }
        if (!$this->validDate($enrollmentDate)) {
            return ['error' => 'Invalid enrollment date'];
        }
        if (!in_array($status, self::STATUSES, true)) {
            return ['error' => 'Invalid enrollment status'];
        }

        $academicYear = $this->entity($pdo, 'academic_years', $academicYearId, $schoolId);
        if (!$academicYear) {
            return ['error' => 'Academic year not found for this school'];
        }
        $student = $this->entity($pdo, 'students', $studentId, $schoolId);
        if (!$student) {
            return ['error' => 'Student not found for this school'];
        }
        $classLevel = $this->entity($pdo, 'class_levels', $classLevelId, $schoolId);
        if (!$classLevel) {
            return ['error' => 'Class level not found for this school'];
        }

        return ['academic_year' => $academicYear, 'student' => $student, 'class_level' => $classLevel];
    }

    private function syncCurrentStudent(PDO $pdo, int $studentId, int $schoolId, array $academicYear, array $classLevel): void
    {
        $levelName = trim((string)($classLevel['level_name'] ?? '')) ?: (string)$classLevel['name'];
        $className = trim((string)($classLevel['group_name'] ?? '')) ?: (string)$classLevel['name'];
        $stmt = $pdo->prepare('
            UPDATE students
            SET class_level_id = ?, class_level = ?, class_name = ?, school_year = ?
            WHERE id = ? AND school_id = ?
        ');
        $stmt->execute([
            $classLevel['id'],
            $levelName,
            $className,
            $academicYear['name'],
            $studentId,
            $schoolId,
        ]);
    }

    private function entity(PDO $pdo, string $table, int $id, int $schoolId): array|false
    {
        $allowedTables = ['academic_years', 'students', 'class_levels'];
        if (!in_array($table, $allowedTables, true)) {
            return false;
        }

        $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? AND school_id = ? LIMIT 1");
        $stmt->execute([$id, $schoolId]);
        return $stmt->fetch() ?: false;
    }

    private function find(int $id): array|false
    {
        $stmt = Database::connect()->prepare('
            SELECT e.*, ay.name AS academic_year_name, ay.is_current AS academic_year_is_current,
                   s.first_name, s.last_name, cl.name AS class_name, cl.level_name, cl.group_name
            FROM enrollments e
            INNER JOIN academic_years ay ON ay.id = e.academic_year_id
            INNER JOIN students s ON s.id = e.student_id
            INNER JOIN class_levels cl ON cl.id = e.class_level_id
            WHERE e.id = ? AND e.school_id = ?
            LIMIT 1
        ');
        $stmt->execute([$id, $this->schoolId()]);
        return $stmt->fetch() ?: false;
    }

    private function validDate(string $date): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        return $parsed && $parsed->format('Y-m-d') === $date;
    }

    private function schoolId(): int
    {
        return (int)(Request::get('auth_user', [])['school_id'] ?? 0);
    }
}
