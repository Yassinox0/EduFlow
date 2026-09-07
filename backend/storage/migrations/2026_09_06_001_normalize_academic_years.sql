-- Canonical academic-year representation:
-- name, start_date, end_date, status and is_current.
-- The legacy label/starts_on/ends_on columns are deliberately retained for
-- backwards compatibility; application code must no longer read them.

SET @schema_name := DATABASE();

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'academic_years' AND COLUMN_NAME = 'name'),
    'SELECT 1',
    'ALTER TABLE academic_years ADD COLUMN name VARCHAR(30) NULL AFTER school_id'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'academic_years' AND COLUMN_NAME = 'start_date'),
    'SELECT 1',
    'ALTER TABLE academic_years ADD COLUMN start_date DATE NULL AFTER name'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'academic_years' AND COLUMN_NAME = 'end_date'),
    'SELECT 1',
    'ALTER TABLE academic_years ADD COLUMN end_date DATE NULL AFTER start_date'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'academic_years' AND COLUMN_NAME = 'is_current'),
    'SELECT 1',
    'ALTER TABLE academic_years ADD COLUMN is_current TINYINT(1) NOT NULL DEFAULT 0 AFTER status'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- Preserve legacy values when a database was created with the old schema.
-- Dynamic SQL is required because a canonical-only database has no legacy
-- columns to reference.
SET @has_legacy_year_columns := (
    SELECT COUNT(*) = 3
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'academic_years'
      AND COLUMN_NAME IN ('label', 'starts_on', 'ends_on')
);
SET @sql := IF(
    @has_legacy_year_columns,
    'UPDATE academic_years SET name = COALESCE(NULLIF(name, ''''), NULLIF(label, '''')), start_date = COALESCE(start_date, starts_on), end_date = COALESCE(end_date, ends_on) WHERE name IS NULL OR name = '''' OR start_date IS NULL OR end_date IS NULL',
    'SELECT 1'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- If an active-year setting does not exist yet, adopt an existing current year.
INSERT INTO school_settings (school_id, setting_key, setting_value)
SELECT ay.school_id, 'active_academic_year_id', CAST(ay.id AS CHAR)
FROM academic_years ay
LEFT JOIN school_settings settings
    ON settings.school_id = ay.school_id
   AND settings.setting_key = 'active_academic_year_id'
WHERE ay.is_current = 1
  AND settings.id IS NULL;

-- Future writes keep is_current aligned in SchoolService and
-- AcademicYearService. It remains a compatibility projection; the setting
-- above is the sole source of truth.
