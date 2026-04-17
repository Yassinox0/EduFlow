CREATE TABLE IF NOT EXISTS parents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'parent_id'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN parent_id INT NULL AFTER school_id'
  )
);
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

INSERT INTO parents (school_id, first_name, last_name, phone)
SELECT
  s.school_id,
  TRIM(SUBSTRING_INDEX(s.parent_name, ' ', 1)) AS first_name,
  TRIM(
    CASE
      WHEN LOCATE(' ', TRIM(s.parent_name)) > 0
        THEN SUBSTRING(TRIM(s.parent_name), LOCATE(' ', TRIM(s.parent_name)) + 1)
      ELSE 'Parent'
    END
  ) AS last_name,
  COALESCE(NULLIF(TRIM(s.phone), ''), 'N/A') AS phone
FROM students s
LEFT JOIN parents p
  ON p.school_id = s.school_id
 AND CONCAT(p.first_name, ' ', p.last_name) = TRIM(s.parent_name)
 AND p.phone = COALESCE(NULLIF(TRIM(s.phone), ''), 'N/A')
WHERE p.id IS NULL;

UPDATE students s
JOIN parents p
  ON p.school_id = s.school_id
 AND CONCAT(p.first_name, ' ', p.last_name) = TRIM(s.parent_name)
 AND p.phone = COALESCE(NULLIF(TRIM(s.phone), ''), 'N/A')
SET s.parent_id = p.id
WHERE s.parent_id IS NULL;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'students' AND index_name = 'students_parent_id_idx'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD INDEX students_parent_id_idx (parent_id)'
  )
);
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE() AND constraint_name = 'students_parent_id_fk'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD CONSTRAINT students_parent_id_fk FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL'
  )
);
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
