<?php
/** Synchronize upstream migrations while retaining the local student-profile schema. */
declare(strict_types=1);
require dirname(__DIR__) . '/vendor/autoload.php';
// Explicit CLI database override; PHP may not populate $_ENV from the process environment.
if (getenv('DB_NAME') !== false && getenv('DB_NAME') !== '') {
    $_ENV['DB_NAME'] = getenv('DB_NAME');
}
Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
$config = require dirname(__DIR__) . '/config/database.php';
fwrite(STDOUT, sprintf("Database: %s:%s/%s\n", $config['host'], $config['port'], $config['dbname']));
if (in_array('--status', $argv, true)) {
    passthru(escapeshellarg(PHP_BINARY).' '.escapeshellarg(__DIR__.'/migrate-upstream.php').' --status', $code);
    exit($code);
}
$pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $config['host'], $config['port'], $config['dbname']), $config['username'], $config['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function hasColumn(PDO $pdo, string $column): bool {
    $q=$pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name="academic_years" AND column_name=?');
    $q->execute([$column]); return (bool)$q->fetchColumn();
}
try {
    if (!$pdo->query("SELECT GET_LOCK('eduflow_database_sync', 10)")->fetchColumn()) throw new RuntimeException('Another synchronization is running.');
    $pdo->exec("CREATE TABLE IF NOT EXISTS local_sync_steps (version VARCHAR(100) PRIMARY KEY, completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    $completed=(bool)$pdo->query("SELECT COUNT(*) FROM local_sync_steps WHERE version='upstream-fbaadeb-compatibility'")->fetchColumn();
    $localYears=hasColumn($pdo, 'label');
    if ($localYears && !$completed) {
        // Durable snapshot permits safe retries after a failed upstream migration.
        $pdo->exec("CREATE TABLE IF NOT EXISTS local_sync_academic_years (id INT PRIMARY KEY, status VARCHAR(20) NOT NULL, updated_at TIMESTAMP NULL)");
        $pdo->exec('INSERT IGNORE INTO local_sync_academic_years SELECT id,status,updated_at FROM academic_years');
        foreach (['name'=>'VARCHAR(30) NULL','start_date'=>'DATE NULL','end_date'=>'DATE NULL','is_current'=>'TINYINT(1) NOT NULL DEFAULT 0'] as $column=>$definition) {
            if (!hasColumn($pdo,$column)) $pdo->exec("ALTER TABLE academic_years ADD COLUMN `$column` $definition");
        }
        $pdo->exec("ALTER TABLE academic_years MODIFY label VARCHAR(30) NOT NULL DEFAULT '', MODIFY status ENUM('ACTIVE','INACTIVE','PLANNED','CLOSED') NOT NULL DEFAULT 'ACTIVE'");
        $pdo->exec("UPDATE academic_years SET name=REPLACE(label,'/','-'), start_date=starts_on, end_date=ends_on, updated_at=updated_at WHERE name IS NULL");
        $exists=$pdo->query("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='academic_years' AND index_name='academic_years_school_name_unique'")->fetchColumn();
        if (!$exists) $pdo->exec('ALTER TABLE academic_years ADD UNIQUE KEY academic_years_school_name_unique(school_id,name)');
        $triggers = [
            'eduflow_academic_year_alias_insert' => "BEFORE INSERT ON academic_years FOR EACH ROW BEGIN
                IF NEW.label IS NULL OR NEW.label='' THEN SET NEW.label=NEW.name; END IF;
                IF NEW.name IS NULL OR NEW.name='' THEN SET NEW.name=REPLACE(NEW.label,'/','-'); END IF;
                SET NEW.start_date=COALESCE(NEW.start_date,NEW.starts_on), NEW.starts_on=COALESCE(NEW.starts_on,NEW.start_date);
                SET NEW.end_date=COALESCE(NEW.end_date,NEW.ends_on), NEW.ends_on=COALESCE(NEW.ends_on,NEW.end_date);
            END",
            'eduflow_academic_year_alias_update' => "BEFORE UPDATE ON academic_years FOR EACH ROW BEGIN
                IF NOT (NEW.label <=> OLD.label) THEN SET NEW.name=REPLACE(NEW.label,'/','-'); ELSEIF NOT (NEW.name <=> OLD.name) THEN SET NEW.label=NEW.name; END IF;
                IF NOT (NEW.starts_on <=> OLD.starts_on) THEN SET NEW.start_date=NEW.starts_on; ELSEIF NOT (NEW.start_date <=> OLD.start_date) THEN SET NEW.starts_on=NEW.start_date; END IF;
                IF NOT (NEW.ends_on <=> OLD.ends_on) THEN SET NEW.end_date=NEW.ends_on; ELSEIF NOT (NEW.end_date <=> OLD.end_date) THEN SET NEW.ends_on=NEW.end_date; END IF;
            END",
        ];
        foreach ($triggers as $name=>$sql) {
            $q=$pdo->prepare('SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=DATABASE() AND trigger_name=?');$q->execute([$name]);
            if (!$q->fetchColumn()) $pdo->exec("CREATE TRIGGER `$name` $sql");
        }
    }
    if ($localYears && !$completed) {
        // The local profile schema permits pupils without a legacy parent name.
        // Complete its existing relationship instead of replaying the old name backfill.
        $index=$pdo->query("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='students' AND index_name='students_parent_id_idx'")->fetchColumn();
        if (!$index) $pdo->exec('ALTER TABLE students ADD INDEX students_parent_id_idx(parent_id)');
        $fk=$pdo->query("SELECT COUNT(*) FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name='students' AND column_name='parent_id' AND referenced_table_name='parents'")->fetchColumn();
        if (!$fk) $pdo->exec('ALTER TABLE students ADD CONSTRAINT students_parent_id_fk FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE SET NULL');
    }
    passthru(escapeshellarg(PHP_BINARY).' '.escapeshellarg(__DIR__.'/migrate-upstream.php'), $code);
    if ($code!==0) throw new RuntimeException('Upstream migration failed; rerun after resolving the reported error.');
    if ($localYears && !$completed) {
        $pdo->beginTransaction();
        $pdo->exec('UPDATE academic_years y JOIN local_sync_academic_years original ON original.id=y.id SET y.status=original.status,y.updated_at=original.updated_at');
        $pdo->exec("UPDATE enrollments e JOIN students s ON s.id=e.student_id AND s.school_id=e.school_id SET e.status='ACTIVE' WHERE s.status='REGISTERED' AND e.status='WITHDRAWN'");
        $pdo->exec("INSERT INTO local_sync_steps(version) VALUES ('upstream-fbaadeb-compatibility')");
        $pdo->commit();
    }
    echo "Local compatibility verified. Synchronization complete.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, $e->getMessage()."\n"); exit(1);
} finally {
    $pdo->query("SELECT RELEASE_LOCK('eduflow_database_sync')");
}
