-- 1) Remove consultant role safely
UPDATE users SET role = 'user' WHERE role = 'consultant';
ALTER TABLE users MODIFY role ENUM('super_admin', 'admin', 'user') NOT NULL;

-- 2) Class levels catalog
CREATE TABLE IF NOT EXISTS class_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY class_levels_school_name_unique (school_id, name),
    KEY class_levels_school_id_idx (school_id),
    CONSTRAINT class_levels_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- 3) Students fields for operations
SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'date_of_birth'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN date_of_birth DATE NULL AFTER last_name'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'discount_percent'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER monthly_amount'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'school_year'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN school_year VARCHAR(20) NULL AFTER discount_percent'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'class_level_id'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN class_level_id INT NULL AFTER class_level'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'status'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD COLUMN status ENUM(''ACTIVE'', ''INACTIVE'') NOT NULL DEFAULT ''ACTIVE'' AFTER school_year'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- 4) Backfill class_levels from legacy students.class_level
INSERT INTO class_levels (school_id, name, code, sort_order, status)
SELECT DISTINCT
    s.school_id,
    TRIM(s.class_level) AS level_name,
    NULL,
    0,
    'ACTIVE'
FROM students s
LEFT JOIN class_levels cl
    ON cl.school_id = s.school_id
   AND cl.name = TRIM(s.class_level)
WHERE TRIM(COALESCE(s.class_level, '')) <> ''
  AND cl.id IS NULL;

UPDATE students s
JOIN class_levels cl
  ON cl.school_id = s.school_id
 AND cl.name = TRIM(s.class_level)
SET s.class_level_id = cl.id
WHERE s.class_level_id IS NULL;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'students' AND index_name = 'students_class_level_id_idx'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD INDEX students_class_level_id_idx (class_level_id)'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE() AND constraint_name = 'students_class_level_id_fk'
    ),
    'SELECT 1',
    'ALTER TABLE students ADD CONSTRAINT students_class_level_id_fk FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE SET NULL'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- 5) Payment methods catalog
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO payment_methods (code, label, status) VALUES
('CASH', 'Especes', 'ACTIVE'),
('CARD', 'Carte bancaire', 'ACTIVE'),
('BANK_TRANSFER', 'Virement bancaire', 'ACTIVE'),
('CHECK', 'Cheque', 'ACTIVE'),
('MOBILE', 'Paiement mobile', 'ACTIVE');

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'payment_method_id'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN payment_method_id INT NULL AFTER payment_date'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE payments p
LEFT JOIN payment_methods pm
  ON pm.code = CASE
      WHEN UPPER(TRIM(p.payment_method)) IN ('CASH', 'ESPECES', 'LIQUIDE', 'LIQUIDES') THEN 'CASH'
      WHEN UPPER(TRIM(p.payment_method)) IN ('CARD', 'CARTE', 'CB') THEN 'CARD'
      WHEN UPPER(TRIM(p.payment_method)) IN ('BANK_TRANSFER', 'TRANSFER', 'VIREMENT') THEN 'BANK_TRANSFER'
      WHEN UPPER(TRIM(p.payment_method)) IN ('CHECK', 'CHEQUE') THEN 'CHECK'
      WHEN UPPER(TRIM(p.payment_method)) IN ('MOBILE', 'MOBILE_PAYMENT') THEN 'MOBILE'
      ELSE UPPER(TRIM(p.payment_method))
  END
SET p.payment_method_id = pm.id
WHERE p.payment_method_id IS NULL;

UPDATE payments p
JOIN payment_methods pm ON pm.code = 'CASH'
SET p.payment_method_id = pm.id
WHERE p.payment_method_id IS NULL;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'payments' AND index_name = 'payments_payment_method_id_idx'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD INDEX payments_payment_method_id_idx (payment_method_id)'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @q := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE() AND constraint_name = 'payments_payment_method_id_fk'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD CONSTRAINT payments_payment_method_id_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL'
  )
);
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
