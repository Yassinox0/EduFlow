CREATE TABLE IF NOT EXISTS school_fee_settings (
 id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, fee_code VARCHAR(60) NOT NULL, label VARCHAR(120) NOT NULL,
 default_amount DECIMAL(10,2) NOT NULL DEFAULT 0, billing_month TINYINT NULL, applies_cycle_id INT NULL, status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
 UNIQUE KEY school_fee_settings_unique (school_id, fee_code), FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (applies_cycle_id) REFERENCES school_cycles(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS student_financial_items (
 id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, student_id INT NOT NULL, academic_year_id INT NULL, item_code VARCHAR(60) NOT NULL, label VARCHAR(120) NOT NULL,
 billing_month TINYINT NULL, quantity DECIMAL(8,2) NOT NULL DEFAULT 1, unit_amount DECIMAL(10,2) NOT NULL DEFAULT 0, total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
 discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0, paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0, status ENUM('UNPAID','PARTIAL','PAID','EXEMPT') NOT NULL DEFAULT 'UNPAID', justification TEXT NULL, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY student_financial_items_single_charge (school_id,student_id,academic_year_id,item_code,billing_month),
 KEY student_financial_items_student_idx (school_id,student_id), FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
