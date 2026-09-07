-- Phase 1: dossier eleve, referentiels scolaires et permissions.
-- Cette migration est volontairement additive; executez-la une seule fois sur une sauvegarde de la base.

CREATE TABLE IF NOT EXISTS academic_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    label VARCHAR(30) NOT NULL,
    starts_on DATE NULL,
    ends_on DATE NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY academic_years_school_label_unique (school_id, label),
    CONSTRAINT academic_years_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS school_cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY school_cycles_school_code_unique (school_id, code),
    CONSTRAINT school_cycles_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS school_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    cycle_id INT NULL,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY school_levels_school_code_unique (school_id, code),
    CONSTRAINT school_levels_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT school_levels_cycle_fk FOREIGN KEY (cycle_id) REFERENCES school_cycles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS school_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY school_settings_school_key_unique (school_id, setting_key),
    CONSTRAINT school_settings_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT school_settings_user_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    label VARCHAR(160) NOT NULL,
    UNIQUE KEY permissions_code_unique (code)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role VARCHAR(30) NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role, permission_id),
    CONSTRAINT role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, label) VALUES
('students.manage', 'Gerer les eleves'), ('students.import', 'Importer les eleves'),
('families.manage', 'Gerer les familles'), ('student_finance.view', 'Consulter la finance eleve'),
('payments.export', 'Exporter les paiements'), ('expenses.view', 'Consulter les depenses'),
('expenses.create', 'Creer les depenses'), ('expenses.approve', 'Valider les depenses'),
('expenses.export', 'Exporter les depenses'), ('expense_categories.manage', 'Gerer les categories de depenses');

INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

ALTER TABLE students
    ADD COLUMN internal_number VARCHAR(80) NULL AFTER school_id,
    ADD COLUMN massar_code VARCHAR(80) NULL AFTER internal_number,
    ADD COLUMN cne VARCHAR(80) NULL AFTER massar_code,
    ADD COLUMN photo_path VARCHAR(255) NULL AFTER cne,
    ADD COLUMN last_name_ar VARCHAR(100) NULL AFTER last_name,
    ADD COLUMN first_name_ar VARCHAR(100) NULL AFTER first_name,
    ADD COLUMN birth_place VARCHAR(150) NULL AFTER date_of_birth,
    ADD COLUMN nationality VARCHAR(100) NULL AFTER birth_place,
    ADD COLUMN entry_date DATE NULL AFTER nationality,
    ADD COLUMN previous_school VARCHAR(180) NULL AFTER entry_date,
    ADD COLUMN registration_date DATE NULL AFTER previous_school,
    ADD COLUMN academic_year_id INT NULL AFTER school_year,
    ADD COLUMN cycle_id INT NULL AFTER academic_year_id,
    ADD COLUMN school_level_id INT NULL AFTER cycle_id,
    ADD COLUMN archived_at TIMESTAMP NULL AFTER status,
    ADD COLUMN archived_by INT NULL AFTER archived_at,
    ADD COLUMN archive_reason TEXT NULL AFTER archived_by;

ALTER TABLE students MODIFY parent_name VARCHAR(150) NULL, MODIFY phone VARCHAR(30) NULL;
ALTER TABLE students MODIFY status VARCHAR(30) NOT NULL DEFAULT 'PRE_REGISTERED';
UPDATE students SET status = CASE status WHEN 'ACTIVE' THEN 'REGISTERED' WHEN 'INACTIVE' THEN 'ARCHIVED' ELSE status END;
ALTER TABLE students MODIFY status ENUM('PRE_REGISTERED','REGISTERED','WAITING_LIST','CANCELLED','ARCHIVED') NOT NULL DEFAULT 'PRE_REGISTERED';

ALTER TABLE students ADD UNIQUE KEY students_school_internal_number_unique (school_id, internal_number);
ALTER TABLE students ADD UNIQUE KEY students_school_massar_code_unique (school_id, massar_code);
ALTER TABLE students ADD KEY students_school_status_idx (school_id, status);
ALTER TABLE students ADD CONSTRAINT students_academic_year_fk FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE students ADD CONSTRAINT students_cycle_fk FOREIGN KEY (cycle_id) REFERENCES school_cycles(id) ON DELETE SET NULL;
ALTER TABLE students ADD CONSTRAINT students_school_level_fk FOREIGN KEY (school_level_id) REFERENCES school_levels(id) ON DELETE SET NULL;
ALTER TABLE students ADD CONSTRAINT students_archived_by_fk FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS student_status_histories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason TEXT NULL,
    changed_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY student_status_histories_school_student_idx (school_id, student_id),
    CONSTRAINT student_status_histories_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT student_status_histories_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT student_status_histories_user_fk FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO student_status_histories (school_id, student_id, previous_status, new_status, reason)
SELECT s.school_id, s.id, NULL, s.status, 'Migration Phase 1'
FROM students s
WHERE NOT EXISTS (SELECT 1 FROM student_status_histories h WHERE h.student_id = s.id);
