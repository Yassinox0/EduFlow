SET @add_students_school_id := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'school_id'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN school_id INT NULL AFTER id'
  )
);
PREPARE stmt_add_students_school_id FROM @add_students_school_id;
EXECUTE stmt_add_students_school_id;
DEALLOCATE PREPARE stmt_add_students_school_id;

SET @add_monthly_fees_school_id := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'monthly_fees' AND column_name = 'school_id'
    ),
    'SELECT 1',
    'ALTER TABLE monthly_fees ADD COLUMN school_id INT NULL AFTER id'
  )
);
PREPARE stmt_add_monthly_fees_school_id FROM @add_monthly_fees_school_id;
EXECUTE stmt_add_monthly_fees_school_id;
DEALLOCATE PREPARE stmt_add_monthly_fees_school_id;

SET @add_payments_school_id := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'school_id'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN school_id INT NULL AFTER id'
  )
);
PREPARE stmt_add_payments_school_id FROM @add_payments_school_id;
EXECUTE stmt_add_payments_school_id;
DEALLOCATE PREPARE stmt_add_payments_school_id;

UPDATE monthly_fees mf
JOIN students s ON s.id = mf.student_id
SET mf.school_id = s.school_id
WHERE mf.school_id IS NULL;

UPDATE payments p
JOIN students s ON s.id = p.student_id
SET p.school_id = s.school_id
WHERE p.school_id IS NULL;

SET @idx_students_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'students' AND index_name = 'students_school_id_idx'),
    'SELECT 1',
    'ALTER TABLE students ADD INDEX students_school_id_idx (school_id)'
  )
);
PREPARE stmt_idx_students_school FROM @idx_students_school;
EXECUTE stmt_idx_students_school;
DEALLOCATE PREPARE stmt_idx_students_school;

SET @idx_fees_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'monthly_fees' AND index_name = 'monthly_fees_school_id_idx'),
    'SELECT 1',
    'ALTER TABLE monthly_fees ADD INDEX monthly_fees_school_id_idx (school_id)'
  )
);
PREPARE stmt_idx_fees_school FROM @idx_fees_school;
EXECUTE stmt_idx_fees_school;
DEALLOCATE PREPARE stmt_idx_fees_school;

SET @idx_payments_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'payments' AND index_name = 'payments_school_id_idx'),
    'SELECT 1',
    'ALTER TABLE payments ADD INDEX payments_school_id_idx (school_id)'
  )
);
PREPARE stmt_idx_payments_school FROM @idx_payments_school;
EXECUTE stmt_idx_payments_school;
DEALLOCATE PREPARE stmt_idx_payments_school;

SET @fk_students_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND constraint_name = 'students_school_id_fk'),
    'SELECT 1',
    'ALTER TABLE students ADD CONSTRAINT students_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE'
  )
);
PREPARE stmt_fk_students_school FROM @fk_students_school;
EXECUTE stmt_fk_students_school;
DEALLOCATE PREPARE stmt_fk_students_school;

SET @fk_fees_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND constraint_name = 'monthly_fees_school_id_fk'),
    'SELECT 1',
    'ALTER TABLE monthly_fees ADD CONSTRAINT monthly_fees_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE'
  )
);
PREPARE stmt_fk_fees_school FROM @fk_fees_school;
EXECUTE stmt_fk_fees_school;
DEALLOCATE PREPARE stmt_fk_fees_school;

SET @fk_payments_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND constraint_name = 'payments_school_id_fk'),
    'SELECT 1',
    'ALTER TABLE payments ADD CONSTRAINT payments_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE'
  )
);
PREPARE stmt_fk_payments_school FROM @fk_payments_school;
EXECUTE stmt_fk_payments_school;
DEALLOCATE PREPARE stmt_fk_payments_school;
