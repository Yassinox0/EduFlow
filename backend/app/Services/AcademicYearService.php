<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use PDOException;

class AcademicYearService
{
    private const STATUSES = ['PLANNED', 'ACTIVE', 'CLOSED'];

    public function getAll(): array
    {
        $stmt = Database::connect()->prepare('
            SELECT id, school_id, name, start_date, end_date, is_current, status, created_at, updated_at
            FROM academic_years
            WHERE school_id = ?
            ORDER BY is_current DESC, name DESC
        ');
        $stmt->execute([$this->schoolId()]);

        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connect();
        $schoolId = $this->schoolId();
        $name = trim((string)($data['name'] ?? ''));
        $startDate = $this->nullableDate($data['start_date'] ?? null);
        $endDate = $this->nullableDate($data['end_date'] ?? null);

        if (!$this->validName($name)) {
            return ['error' => 'Academic year must use the YYYY/YYYY or YYYY-YYYY format'];
        }
        if ($startDate === false || $endDate === false) {
            return ['error' => 'Invalid academic year date'];
        }
        if ($startDate !== null && $endDate !== null && $endDate < $startDate) {
            return ['error' => 'Academic year end date must be after start date'];
        }

        $currentCount = $pdo->prepare('SELECT COUNT(*) FROM school_settings WHERE school_id = ? AND setting_key = "active_academic_year_id"');
        $currentCount->execute([$schoolId]);
        $isCurrent = array_key_exists('is_current', $data)
            ? $this->boolean($data['is_current'])
            : (int)$currentCount->fetchColumn() === 0;
        $status = strtoupper(trim((string)($data['status'] ?? ($isCurrent ? 'ACTIVE' : 'PLANNED'))));

        if (!in_array($status, self::STATUSES, true)) {
            return ['error' => 'Invalid academic year status'];
        }
        if ($isCurrent && $status === 'CLOSED') {
            return ['error' => 'A current academic year cannot be closed'];
        }
        if ($isCurrent) {
            $status = 'ACTIVE';
        }

        try {
            $pdo->beginTransaction();
            if ($isCurrent) {
                $this->clearCurrentYear($pdo, $schoolId);
            }

            $stmt = $pdo->prepare('
                INSERT INTO academic_years (
                    school_id, name, start_date, end_date, is_current, status
                ) VALUES (?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([$schoolId, $name, $startDate, $endDate, $isCurrent ? 1 : 0, $status]);
            $id = (int)$pdo->lastInsertId();
            if ($isCurrent) {
                $this->storeActiveYear($pdo, $schoolId, $id);
            }
            $pdo->commit();

            return $this->find($id) + ['message' => 'Academic year created successfully'];
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
                return ['error' => 'Academic year already exists for this school'];
            }

            return ['error' => 'Academic year creation failed'];
        }
    }

    public function update(int $id, array $data): array
    {
        $pdo = Database::connect();
        $schoolId = $this->schoolId();
        $existing = $this->find($id);

        if (!$existing) {
            return ['error' => 'Academic year not found'];
        }

        $name = array_key_exists('name', $data) ? trim((string)$data['name']) : (string)$existing['name'];
        $startDate = array_key_exists('start_date', $data)
            ? $this->nullableDate($data['start_date'])
            : $existing['start_date'];
        $endDate = array_key_exists('end_date', $data)
            ? $this->nullableDate($data['end_date'])
            : $existing['end_date'];
        $isCurrent = array_key_exists('is_current', $data)
            ? $this->boolean($data['is_current'])
            : (bool)$existing['is_current'];
        $status = array_key_exists('status', $data)
            ? strtoupper(trim((string)$data['status']))
            : (string)$existing['status'];

        if (!$this->validName($name)) {
            return ['error' => 'Academic year must use the YYYY/YYYY or YYYY-YYYY format'];
        }
        if ($startDate === false || $endDate === false) {
            return ['error' => 'Invalid academic year date'];
        }
        if ($startDate !== null && $endDate !== null && $endDate < $startDate) {
            return ['error' => 'Academic year end date must be after start date'];
        }
        if (!in_array($status, self::STATUSES, true)) {
            return ['error' => 'Invalid academic year status'];
        }
        if ($this->activeYearId($pdo, $schoolId) === $id && !$isCurrent) {
            return ['error' => 'Select another current academic year before disabling this one'];
        }
        if ($isCurrent && $status === 'CLOSED') {
            return ['error' => 'A current academic year cannot be closed'];
        }
        if ($isCurrent) {
            $status = 'ACTIVE';
        }

        try {
            $pdo->beginTransaction();
            if ($isCurrent) {
                $this->clearCurrentYear($pdo, $schoolId, $id);
            }

            $stmt = $pdo->prepare('
                UPDATE academic_years
                SET name = ?, start_date = ?, end_date = ?, is_current = ?, status = ?
                WHERE id = ? AND school_id = ?
            ');
            $stmt->execute([$name, $startDate, $endDate, $isCurrent ? 1 : 0, $status, $id, $schoolId]);
            if ($isCurrent) {
                $this->storeActiveYear($pdo, $schoolId, $id);
            }
            $pdo->commit();

            return $this->find($id) + ['message' => 'Academic year updated successfully'];
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ((int)($exception->errorInfo[1] ?? 0) === 1062) {
                return ['error' => 'Academic year already exists for this school'];
            }

            return ['error' => 'Academic year update failed'];
        }
    }

    private function find(int $id): array|false
    {
        $stmt = Database::connect()->prepare('
            SELECT id, school_id, name, start_date, end_date, is_current, status, created_at, updated_at
            FROM academic_years
            WHERE id = ? AND school_id = ?
            LIMIT 1
        ');
        $stmt->execute([$id, $this->schoolId()]);

        return $stmt->fetch() ?: false;
    }

    private function clearCurrentYear(PDO $pdo, int $schoolId, ?int $exceptId = null): void
    {
        $sql = 'UPDATE academic_years SET is_current = 0 WHERE school_id = ? AND is_current = 1';
        $parameters = [$schoolId];

        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $parameters[] = $exceptId;
        }

        $pdo->prepare($sql)->execute($parameters);
    }

    private function storeActiveYear(PDO $pdo, int $schoolId, int $yearId): void
    {
        $user = Request::get('auth_user', []);
        $stmt = $pdo->prepare('
            INSERT INTO school_settings (school_id, setting_key, setting_value, updated_by)
            VALUES (?, "active_academic_year_id", ?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
        ');
        $stmt->execute([$schoolId, (string)$yearId, (int)($user['id'] ?? 0) ?: null]);
    }

    private function activeYearId(PDO $pdo, int $schoolId): ?int
    {
        $stmt = $pdo->prepare('
            SELECT ay.id
            FROM school_settings settings
            INNER JOIN academic_years ay
                ON ay.id = CAST(settings.setting_value AS UNSIGNED)
               AND ay.school_id = settings.school_id
            WHERE settings.school_id = ?
              AND settings.setting_key = "active_academic_year_id"
            LIMIT 1
        ');
        $stmt->execute([$schoolId]);
        $id = (int)($stmt->fetchColumn() ?: 0);

        return $id > 0 ? $id : null;
    }

    private function validName(string $name): bool
    {
        if (!preg_match('/^(\d{4})[\/-](\d{4})$/', $name, $matches)) {
            return false;
        }

        return (int)$matches[2] === (int)$matches[1] + 1;
    }

    private function nullableDate(mixed $value): string|null|false
    {
        $date = trim((string)$value);
        if ($date === '') {
            return null;
        }

        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        return $parsed && $parsed->format('Y-m-d') === $date ? $date : false;
    }

    private function boolean(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    private function schoolId(): int
    {
        return (int)(Request::get('auth_user', [])['school_id'] ?? 0);
    }
}
