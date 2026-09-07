CREATE TABLE IF NOT EXISTS charge_categories (
 id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, code VARCHAR(60) NOT NULL, label VARCHAR(120) NOT NULL, description TEXT NULL,
 default_amount DECIMAL(12,2) NULL, periodicity ENUM('MONTHLY','ANNUAL','ONE_TIME','SELECTED_MONTHS','CUSTOM') NOT NULL DEFAULT 'ONE_TIME', status ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY charge_categories_school_code_unique (school_id,code), KEY charge_categories_school_status_idx (school_id,status), CONSTRAINT charge_categories_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'TUITION','Mensualité scolaire','MONTHLY' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'REGISTRATION','Inscription','ONE_TIME' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'REREGISTRATION','Réinscription','ONE_TIME' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'INSURANCE','Assurance','ANNUAL' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'PAPER','Ramette','ONE_TIME' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'SMOCK','Blouse','ONE_TIME' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'CANTEEN','Cantine','SELECTED_MONTHS' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'TRANSPORT','Transport','SELECTED_MONTHS' FROM schools;
INSERT IGNORE INTO charge_categories (school_id,code,label,periodicity) SELECT id,'OTHER','Autre charge','CUSTOM' FROM schools;

CREATE TABLE IF NOT EXISTS student_financial_item_details (
 student_financial_item_id INT PRIMARY KEY, school_id INT NOT NULL, charge_category_id INT NULL, billing_month TINYINT NULL, year_value INT NULL, due_date DATE NULL,
 original_amount DECIMAL(12,2) NOT NULL DEFAULT 0, discount_type ENUM('PERCENTAGE','FIXED') NULL, discount_value DECIMAL(12,2) NULL, final_amount DECIMAL(12,2) NOT NULL DEFAULT 0, notes TEXT NULL, modified_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
 KEY student_financial_item_details_category_idx (school_id,charge_category_id), KEY student_financial_item_details_period_idx (school_id,year_value,billing_month), CONSTRAINT student_financial_item_details_item_fk FOREIGN KEY (student_financial_item_id) REFERENCES student_financial_items(id) ON DELETE CASCADE, CONSTRAINT student_financial_item_details_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, CONSTRAINT student_financial_item_details_category_fk FOREIGN KEY (charge_category_id) REFERENCES charge_categories(id) ON DELETE SET NULL, CONSTRAINT student_financial_item_details_user_fk FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS charge_discounts (
 id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, discount_type ENUM('PERCENTAGE','FIXED') NOT NULL, discount_value DECIMAL(12,2) NOT NULL, reason VARCHAR(255) NOT NULL, starts_on DATE NULL, ends_on DATE NULL, status ENUM('ACTIVE','EXPIRED','REPLACED','CANCELLED') NOT NULL DEFAULT 'ACTIVE', created_by INT NULL, replaced_by INT NULL, cancellation_reason TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
 KEY charge_discounts_school_status_idx (school_id,status), CONSTRAINT charge_discounts_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, CONSTRAINT charge_discounts_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS charge_discount_targets (
 id INT AUTO_INCREMENT PRIMARY KEY, discount_id INT NOT NULL, student_id INT NOT NULL, charge_category_id INT NULL, UNIQUE KEY charge_discount_targets_unique(discount_id,student_id,charge_category_id), KEY charge_discount_targets_student_idx(student_id), CONSTRAINT charge_discount_targets_discount_fk FOREIGN KEY(discount_id) REFERENCES charge_discounts(id) ON DELETE CASCADE, CONSTRAINT charge_discount_targets_student_fk FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE, CONSTRAINT charge_discount_targets_category_fk FOREIGN KEY(charge_category_id) REFERENCES charge_categories(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS student_financial_item_history (
 id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, student_financial_item_id INT NOT NULL, action VARCHAR(50) NOT NULL, before_data JSON NULL, after_data JSON NULL, reason TEXT NULL, changed_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY student_financial_item_history_item_idx(student_financial_item_id), CONSTRAINT student_financial_item_history_school_fk FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE, CONSTRAINT student_financial_item_history_item_fk FOREIGN KEY(student_financial_item_id) REFERENCES student_financial_items(id) ON DELETE CASCADE, CONSTRAINT student_financial_item_history_user_fk FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL
);
