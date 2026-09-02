INSERT INTO academic_years (school_id,label,status)
SELECT DISTINCT school_id, REPLACE(school_year,'/','-'), 'ACTIVE'
FROM class_levels
WHERE TRIM(COALESCE(school_year,'')) <> ''
ON DUPLICATE KEY UPDATE status='ACTIVE';
