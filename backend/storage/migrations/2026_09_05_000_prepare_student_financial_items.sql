-- Additive financial-item foundation for the flexible charges module.
-- OneCore owns the academic-year schema; this table is intentionally separate
-- from monthly_fees so custom charges do not alter the upstream payment flow.
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    UNIQUE KEY permissions_code_unique (code)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_id INT NOT NULL,
    UNIQUE KEY role_permissions_role_permission_unique (role, permission_id),
    CONSTRAINT role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_financial_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    academic_year_id INT NULL,
    item_code VARCHAR(60) NOT NULL,
    label VARCHAR(120) NOT NULL,
    billing_month TINYINT NULL,
    quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
    unit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM('UNPAID','PARTIAL','PAID','EXEMPT') NOT NULL DEFAULT 'UNPAID',
    justification TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY student_financial_items_single_charge (school_id, student_id, academic_year_id, item_code, billing_month),
    KEY student_financial_items_student_idx (school_id, student_id),
    CONSTRAINT student_financial_items_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT student_financial_items_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT student_financial_items_academic_year_fk FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    CONSTRAINT student_financial_items_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
