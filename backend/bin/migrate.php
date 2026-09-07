<?php

declare(strict_types=1);

use Dotenv\Dotenv;

$backendDirectory = dirname(__DIR__);
$autoloadPath = $backendDirectory . '/vendor/autoload.php';
$migrationDirectory = $backendDirectory . '/storage/migrations';
$statusOnly = in_array('--status', $argv, true);
$onlyArgument = array_values(array_filter(
    $argv,
    static fn (string $argument): bool => str_starts_with($argument, '--only=')
));
$onlyVersion = $onlyArgument ? substr($onlyArgument[0], strlen('--only=')) : null;

if (!is_file($autoloadPath)) {
    fwrite(STDERR, "Backend dependencies are missing. Run composer install in backend.\n");
    exit(1);
}

require $autoloadPath;

Dotenv::createImmutable($backendDirectory)->safeLoad();
$databaseConfig = require $backendDirectory . '/config/database.php';

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $databaseConfig['host'],
    $databaseConfig['port'],
    $databaseConfig['dbname']
);

try {
    $pdo = new PDO(
        $dsn,
        $databaseConfig['username'],
        $databaseConfig['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => true,
            PDO::MYSQL_ATTR_MULTI_STATEMENTS => true,
        ]
    );
} catch (Throwable $exception) {
    fwrite(STDERR, 'Database connection failed: ' . $exception->getMessage() . "\n");
    exit(1);
}

/**
 * Each condition describes the final schema state produced by a legacy migration.
 * This lets an existing database adopt the migration ledger without rerunning DDL.
 */
$legacyRequirements = [
    '2026_04_16_add_logo_path_to_schools.sql' => [
        ['column', 'schools', 'logo_path'],
    ],
    '2026_04_16_add_school_id_business_tables.sql' => [
        ['column', 'students', 'school_id'],
        ['column', 'monthly_fees', 'school_id'],
        ['column', 'payments', 'school_id'],
    ],
    '2026_04_16_multitenant_superadmin.sql' => [
        ['column', 'schools', 'slug'],
        ['column', 'schools', 'email_domain'],
        ['column', 'schools', 'logo_path'],
        ['column', 'users', 'school_id'],
    ],
    '2026_04_17_add_parents_table.sql' => [
        ['table', 'parents'],
        ['column', 'students', 'parent_id'],
        ['index', 'students', 'students_parent_id_idx'],
    ],
    '2026_04_17_architecture_upgrade.sql' => [
        ['column', 'schools', 'code'],
        ['column', 'schools', 'slug'],
        ['column', 'schools', 'email_domain'],
        ['column', 'schools', 'logo_path'],
        ['column', 'schools', 'phone'],
        ['column', 'schools', 'address'],
        ['column', 'schools', 'city'],
        ['column', 'schools', 'country'],
        ['column', 'schools', 'primary_color'],
        ['column', 'schools', 'secondary_color'],
        ['column', 'schools', 'currency'],
        ['column', 'schools', 'status'],
        ['column', 'users', 'school_id'],
        ['column', 'users', 'first_name'],
        ['column', 'users', 'last_name'],
        ['column', 'users', 'status'],
    ],
    '2026_05_11_user_student_payment_upgrade.sql' => [
        ['table', 'class_levels'],
        ['table', 'payment_methods'],
        ['column', 'students', 'date_of_birth'],
        ['column', 'students', 'discount_percent'],
        ['column', 'students', 'school_year'],
        ['column', 'students', 'class_level_id'],
        ['column', 'students', 'status'],
        ['column', 'payments', 'payment_method_id'],
    ],
    '2026_06_26_add_alert_indexes.sql' => [
        ['index', 'monthly_fees', 'monthly_fees_school_status_idx'],
        ['index', 'monthly_fees', 'monthly_fees_student_status_idx'],
        ['index', 'monthly_fees', 'monthly_fees_school_period_idx'],
        ['index', 'payments', 'payments_school_date_idx'],
        ['index', 'payments', 'payments_student_idx'],
        ['index', 'payments', 'payments_monthly_fee_idx'],
    ],
    '2026_06_26_add_student_import_fields.sql' => [
        ['column', 'students', 'gender'],
        ['column', 'students', 'class_name'],
        ['column', 'students', 'address'],
    ],
    '2026_08_27_add_schedule_week_filters.sql' => [
        ['column', 'schedules', 'year_value'],
        ['column', 'schedules', 'week_number'],
        ['index', 'schedules', 'schedules_school_week_day_idx'],
        ['index', 'schedules', 'schedules_class_week_day_idx'],
    ],
    '2026_08_27_create_schedules_table.sql' => [
        ['table', 'subjects'],
        ['table', 'schedules'],
    ],
    '2026_08_27_create_subjects_and_schedule_refs.sql' => [
        ['table', 'subject_class_levels'],
        ['column', 'schedules', 'subject_id'],
        ['column', 'schedules', 'teacher_id'],
        ['index', 'schedules', 'schedules_teacher_day_idx'],
    ],
    '2026_08_28_add_class_import_metadata.sql' => [
        ['column', 'class_levels', 'level_name'],
        ['column', 'class_levels', 'school_year'],
    ],
    '2026_08_28_add_group_and_external_schedule.sql' => [
        ['column', 'class_levels', 'group_name'],
        ['column', 'schedules', 'is_external'],
        ['nullable', 'schedules', 'class_level_id'],
    ],
    '2026_08_29_teacher_profile_and_schedule_type.sql' => [
        ['column', 'users', 'gender'],
        ['column', 'users', 'phone'],
        ['column', 'users', 'address'],
        ['column', 'users', 'primary_school'],
        ['column', 'schedules', 'schedule_type'],
    ],
    '2026_08_31_professor_role_and_subject_weekly_hours.sql' => [
        ['column_contains', 'users', 'role', 'professeur'],
        ['column', 'subject_class_levels', 'weekly_hours'],
    ],
    '2026_08_31_teacher_class_levels.sql' => [
        ['table', 'teacher_class_levels'],
    ],
    '2026_08_31_teacher_subjects.sql' => [
        ['table', 'teacher_subjects'],
    ],
    '2026_09_05_004_teacher_accounts_grades_attendance.sql' => [
        ['column', 'users', 'must_change_password'],
        ['column', 'users', 'token_version'],
        ['column', 'users', 'photo_path'],
        ['table', 'grading_periods'],
        ['table', 'assessments'],
        ['table', 'student_grades'],
        ['table', 'grade_history'],
        ['table', 'attendance_sessions'],
        ['table', 'student_absences'],
    ],
];

function queryValue(PDO $pdo, string $sql, array $parameters = []): mixed
{
    $statement = $pdo->prepare($sql);
    $statement->execute($parameters);

    return $statement->fetchColumn();
}

function tableExists(PDO $pdo, string $table): bool
{
    return (int) queryValue(
        $pdo,
        'SELECT COUNT(*) FROM information_schema.TABLES '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [$table]
    ) > 0;
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    return (int) queryValue(
        $pdo,
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [$table, $column]
    ) > 0;
}

function indexExists(PDO $pdo, string $table, string $index): bool
{
    return (int) queryValue(
        $pdo,
        'SELECT COUNT(*) FROM information_schema.STATISTICS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
        [$table, $index]
    ) > 0;
}

function columnContains(PDO $pdo, string $table, string $column, string $value): bool
{
    $columnType = queryValue(
        $pdo,
        'SELECT COLUMN_TYPE FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [$table, $column]
    );

    return is_string($columnType)
        && str_contains(strtolower($columnType), strtolower($value));
}

function columnIsNullable(PDO $pdo, string $table, string $column): bool
{
    return queryValue(
        $pdo,
        'SELECT IS_NULLABLE FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [$table, $column]
    ) === 'YES';
}

function conditionIsMet(PDO $pdo, array $condition): bool
{
    return match ($condition[0]) {
        'table' => tableExists($pdo, $condition[1]),
        'column' => columnExists($pdo, $condition[1], $condition[2]),
        'index' => indexExists($pdo, $condition[1], $condition[2]),
        'column_contains' => columnContains(
            $pdo,
            $condition[1],
            $condition[2],
            $condition[3]
        ),
        'nullable' => columnIsNullable($pdo, $condition[1], $condition[2]),
        default => false,
    };
}

function requirementsAreMet(PDO $pdo, array $requirements): bool
{
    foreach ($requirements as $condition) {
        if (!conditionIsMet($pdo, $condition)) {
            return false;
        }
    }

    return true;
}

function executeMigration(PDO $pdo, string $sql): void
{
    $statement = $pdo->prepare($sql);
    $statement->execute();

    do {
        if ($statement->columnCount() > 0) {
            $statement->fetchAll();
        }
    } while ($statement->nextRowset());

    $statement->closeCursor();
}

function loadRecordedMigrations(PDO $pdo): array
{
    if (!tableExists($pdo, 'schema_migrations')) {
        return [];
    }

    $rows = $pdo->query(
        'SELECT version, checksum, execution_type FROM schema_migrations ORDER BY version'
    )->fetchAll();

    $recorded = [];
    foreach ($rows as $row) {
        $recorded[$row['version']] = $row;
    }

    return $recorded;
}

if (!is_dir($migrationDirectory)) {
    fwrite(STDERR, "Migration directory was not found.\n");
    exit(1);
}

$migrationFiles = glob($migrationDirectory . '/*.sql') ?: [];
sort($migrationFiles, SORT_STRING);

if ($onlyVersion !== null) {
    if ($onlyVersion === '' || basename($onlyVersion) !== $onlyVersion) {
        fwrite(STDERR, "Invalid --only migration name.\n");
        exit(1);
    }

    $migrationFiles = array_values(array_filter(
        $migrationFiles,
        static fn (string $migrationPath): bool => basename($migrationPath) === $onlyVersion
    ));
    if (!$migrationFiles) {
        fwrite(STDERR, "Requested migration was not found.\n");
        exit(1);
    }
}

if ($statusOnly) {
    $recordedMigrations = loadRecordedMigrations($pdo);
    $hasChanges = false;

    foreach ($migrationFiles as $migrationPath) {
        $version = basename($migrationPath);
        $checksum = hash_file('sha256', $migrationPath);
        $recorded = $recordedMigrations[$version] ?? null;

        if ($recorded !== null) {
            if (!hash_equals($recorded['checksum'], $checksum)) {
                echo "[CHANGED]        {$version}\n";
                $hasChanges = true;
                continue;
            }

            printf("[%-15s] %s\n", $recorded['execution_type'], $version);
            continue;
        }

        $requirements = $legacyRequirements[$version] ?? null;
        if ($requirements !== null && requirementsAreMet($pdo, $requirements)) {
            echo "[BASELINE READY] {$version}\n";
        } else {
            echo "[PENDING]        {$version}\n";
            $hasChanges = true;
        }
    }

    exit($hasChanges ? 2 : 0);
}

try {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (\n"
        . "    version VARCHAR(255) NOT NULL PRIMARY KEY,\n"
        . "    checksum CHAR(64) NOT NULL,\n"
        . "    execution_type ENUM('APPLIED', 'BASELINED') NOT NULL DEFAULT 'APPLIED',\n"
        . "    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n"
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $recordedMigrations = loadRecordedMigrations($pdo);
    $recordMigration = $pdo->prepare(
        'INSERT INTO schema_migrations (version, checksum, execution_type) VALUES (?, ?, ?)'
    );

    foreach ($migrationFiles as $migrationPath) {
        $version = basename($migrationPath);
        $checksum = hash_file('sha256', $migrationPath);
        $recorded = $recordedMigrations[$version] ?? null;

        if ($recorded !== null) {
            if (!hash_equals($recorded['checksum'], $checksum)) {
                throw new RuntimeException(
                    "Migration {$version} was modified after it was recorded."
                );
            }

            echo "[SKIPPED]   {$version}\n";
            continue;
        }

        $requirements = $legacyRequirements[$version] ?? null;
        if ($requirements !== null && requirementsAreMet($pdo, $requirements)) {
            $recordMigration->execute([$version, $checksum, 'BASELINED']);
            echo "[BASELINED] {$version}\n";
            continue;
        }

        $sql = file_get_contents($migrationPath);
        if ($sql === false || trim($sql) === '') {
            throw new RuntimeException("Migration {$version} is empty or unreadable.");
        }

        echo "[APPLYING]   {$version}\n";
        executeMigration($pdo, $sql);
        $recordMigration->execute([$version, $checksum, 'APPLIED']);
        echo "[APPLIED]    {$version}\n";
    }

    echo "Database is up to date.\n";
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
