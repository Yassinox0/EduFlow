CREATE DATABASE IF NOT EXISTS salma_project;
USE salma_project;

CREATE TABLE IF NOT EXISTS schools (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(160) NOT NULL UNIQUE,
    email_domain VARCHAR(160) NOT NULL UNIQUE,
    logo_path VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    primary_color VARCHAR(20) NOT NULL DEFAULT '#1E3A8A',
    secondary_color VARCHAR(20) NOT NULL DEFAULT '#22C55E',
    currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    name VARCHAR(20) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    is_current TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('PLANNED', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY academic_years_school_name_unique (school_id, name),
    KEY academic_years_school_status_idx (school_id, status),
    CONSTRAINT academic_years_school_id_fk
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT academic_years_dates_check
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    password_changed_at DATETIME NULL,
    token_version INT UNSIGNED NOT NULL DEFAULT 1,
    role ENUM('super_admin', 'admin', 'user', 'professeur') NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    gender ENUM('MALE', 'FEMALE') NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(255) NULL,
    primary_school VARCHAR(150) NULL,
    photo_path VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS class_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NULL,
    level_name VARCHAR(180) NULL,
    group_name VARCHAR(100) NULL,
    school_year VARCHAR(20) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY class_levels_school_name_unique (school_id, name),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher_class_levels (
    teacher_id INT NOT NULL,
    class_level_id INT NOT NULL,
    PRIMARY KEY (teacher_id, class_level_id),
    KEY teacher_class_levels_class_level_id_idx (class_level_id),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO subjects (name, code, sort_order, status) VALUES
('Français', 'FR', 1, 'ACTIVE'),
('Arabe', 'AR', 2, 'ACTIVE'),
('Anglais', 'ANG', 3, 'ACTIVE'),
('Mathématiques', 'MATH', 4, 'ACTIVE'),
('Histoire-Géographie', 'H.G', 5, 'ACTIVE'),
('Éducation Islamique', 'II', 6, 'ACTIVE'),
('Sport / EPS', 'EPS', 7, 'ACTIVE'),
('SVT', 'SVT', 8, 'ACTIVE'),
('Physique-Chimie', 'PC', 9, 'ACTIVE'),
('Informatique', 'INFO', 10, 'ACTIVE'),
('Philosophie', 'PHILO', 11, 'ACTIVE')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    sort_order = VALUES(sort_order),
    status = VALUES(status);

CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    KEY teacher_subjects_subject_id_idx (subject_id),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    class_level_id INT NOT NULL,
    weekly_hours TINYINT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY teacher_assignments_scope_unique (
        academic_year_id,
        teacher_id,
        subject_id,
        class_level_id
    ),
    KEY teacher_assignments_teacher_year_idx (teacher_id, academic_year_id, status),
    KEY teacher_assignments_class_year_idx (class_level_id, academic_year_id, status),
    CONSTRAINT teacher_assignments_school_id_fk
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT teacher_assignments_academic_year_id_fk
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    CONSTRAINT teacher_assignments_teacher_id_fk
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT teacher_assignments_subject_id_fk
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
    CONSTRAINT teacher_assignments_class_level_id_fk
        FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS subject_class_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    class_level_id INT NULL,
    weekly_hours TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY subject_class_levels_unique (subject_id, class_level_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE CASCADE
);

INSERT IGNORE INTO subject_class_levels (subject_id, class_level_id)
SELECT s.id, cl.id
FROM subjects s
CROSS JOIN class_levels cl
WHERE
    s.code IN ('FR', 'AR', 'ANG', 'MATH', 'H.G', 'II', 'EPS', 'SVT', 'PC', 'INFO')
    OR (
        s.code = 'PHILO'
        AND (
            LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%tronc commun%'
            OR UPPER(COALESCE(cl.code, '')) = 'TC'
            OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%1 bac%'
            OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%1bac%'
            OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%2 bac%'
            OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%2bac%'
        )
    );

DELETE scl FROM subject_class_levels scl
INNER JOIN subjects s ON s.id = scl.subject_id
INNER JOIN class_levels cl ON cl.id = scl.class_level_id
WHERE s.code = 'INFO'
  AND (
      LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%1 bac%'
      OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%1bac%'
      OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%2 bac%'
      OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%2bac%'
  );

DELETE scl FROM subject_class_levels scl
INNER JOIN subjects s ON s.id = scl.subject_id
INNER JOIN class_levels cl ON cl.id = scl.class_level_id
WHERE s.code = 'H.G'
  AND (
      LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%2 bac%'
      OR LOWER(CONCAT(cl.name, ' ', COALESCE(cl.code, ''))) LIKE '%2bac%'
  );

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

CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    parent_id INT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    photo_path VARCHAR(255) NULL,
    class_level VARCHAR(100) NOT NULL,
    class_name VARCHAR(100) NULL,
    class_level_id INT NULL,
    parent_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    address VARCHAR(255) NULL,
    monthly_amount DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    school_year VARCHAR(20) NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL,
    FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    student_id INT NOT NULL,
    class_level_id INT NOT NULL,
    enrollment_date DATE NOT NULL,
    status ENUM('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY enrollments_student_year_unique (student_id, academic_year_id),
    KEY enrollments_school_year_class_idx (school_id, academic_year_id, class_level_id, status),
    CONSTRAINT enrollments_school_id_fk
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT enrollments_academic_year_id_fk
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    CONSTRAINT enrollments_student_id_fk
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT enrollments_class_level_id_fk
        FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS monthly_fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    month_label VARCHAR(20) NOT NULL,
    year_value INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    remaining_amount DECIMAL(10,2) DEFAULT 0,
    status ENUM('PAID', 'PARTIAL', 'UNPAID') DEFAULT 'UNPAID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY monthly_fees_school_status_idx (school_id, status),
    KEY monthly_fees_student_status_idx (student_id, status),
    KEY monthly_fees_school_period_idx (school_id, year_value, month_label),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO payment_methods (code, label, status) VALUES
('CASH', 'Especes', 'ACTIVE'),
('CARD', 'Carte bancaire', 'ACTIVE'),
('BANK_TRANSFER', 'Virement bancaire', 'ACTIVE'),
('CHECK', 'Cheque', 'ACTIVE'),
('MOBILE', 'Paiement mobile', 'ACTIVE');

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    monthly_fee_id INT NOT NULL,
    receipt_number VARCHAR(40) NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    fee_total_at_payment DECIMAL(10,2) NULL,
    paid_before_payment DECIMAL(10,2) NULL,
    remaining_after_payment DECIMAL(10,2) NULL,
    payment_date DATE NOT NULL,
    payment_method_id INT NULL,
    payment_method VARCHAR(50) NOT NULL,
    issued_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY payments_school_receipt_unique (school_id, receipt_number),
    KEY payments_school_date_idx (school_id, payment_date),
    KEY payments_student_idx (student_id),
    KEY payments_monthly_fee_idx (monthly_fee_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (monthly_fee_id) REFERENCES monthly_fees(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
    FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    class_level_id INT NOT NULL,
    subject_id INT NULL,
    subject VARCHAR(120) NOT NULL,
    teacher_id INT NULL,
    teacher_name VARCHAR(120) NULL,
    room VARCHAR(80) NULL,
    is_external TINYINT(1) NOT NULL DEFAULT 0,
    schedule_type ENUM('eduflow_course', 'external_busy') NOT NULL DEFAULT 'eduflow_course',
    year_value INT NULL,
    week_number TINYINT NULL,
    day_of_week ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    day_order TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT NULL,
    status ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY schedules_school_day_idx (school_id, year_value, week_number, day_order, start_time),
    KEY schedules_class_day_idx (class_level_id, year_value, week_number, day_of_week, start_time),
    KEY schedules_teacher_day_idx (teacher_id, year_value, week_number, day_of_week, start_time),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grading_periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    status ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY grading_periods_year_code_unique (academic_year_id, code),
    KEY grading_periods_school_status_idx (school_id, status),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

INSERT IGNORE INTO grading_periods (school_id, academic_year_id, code, name, start_date, end_date)
SELECT school_id, id, 'SEMESTER_1', 'Semestre 1', start_date,
       CASE WHEN start_date IS NULL THEN NULL ELSE DATE_SUB(DATE_ADD(start_date, INTERVAL 6 MONTH), INTERVAL 1 DAY) END
FROM academic_years;

INSERT IGNORE INTO grading_periods (school_id, academic_year_id, code, name, start_date, end_date)
SELECT school_id, id, 'SEMESTER_2', 'Semestre 2',
       CASE WHEN start_date IS NULL THEN NULL ELSE DATE_ADD(start_date, INTERVAL 6 MONTH) END, end_date
FROM academic_years;

CREATE TABLE IF NOT EXISTS assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    teacher_assignment_id INT NOT NULL,
    grading_period_id INT NOT NULL,
    title VARCHAR(160) NOT NULL,
    assessment_type ENUM('CONTROL', 'HOMEWORK', 'EXAM') NOT NULL DEFAULT 'CONTROL',
    assessment_date DATE NOT NULL,
    max_score DECIMAL(6,2) NOT NULL DEFAULT 20.00,
    coefficient DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    status ENUM('DRAFT', 'PUBLISHED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
    created_by INT NOT NULL,
    published_at DATETIME NULL,
    locked_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY assessments_assignment_period_idx (teacher_assignment_id, grading_period_id, assessment_date),
    KEY assessments_school_status_idx (school_id, status),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE RESTRICT,
    FOREIGN KEY (grading_period_id) REFERENCES grading_periods(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT assessments_score_check CHECK (max_score > 0),
    CONSTRAINT assessments_coefficient_check CHECK (coefficient > 0)
);

CREATE TABLE IF NOT EXISTS student_grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    assessment_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    score DECIMAL(6,2) NULL,
    attendance_status ENUM('PRESENT', 'ABSENT', 'EXCUSED') NOT NULL DEFAULT 'PRESENT',
    remark VARCHAR(500) NULL,
    updated_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY student_grades_assessment_enrollment_unique (assessment_id, enrollment_id),
    KEY student_grades_enrollment_idx (enrollment_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT student_grades_score_check CHECK (score IS NULL OR score >= 0)
);

CREATE TABLE IF NOT EXISTS grade_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    grade_id INT NULL,
    assessment_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    actor_id INT NOT NULL,
    action ENUM('CREATED', 'UPDATED', 'PUBLISHED', 'LOCKED', 'UNLOCKED') NOT NULL,
    old_value JSON NULL,
    new_value JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY grade_history_assessment_created_idx (assessment_id, created_at),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (grade_id) REFERENCES student_grades(id) ON DELETE SET NULL,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    schedule_id INT NULL,
    teacher_id INT NOT NULL,
    class_level_id INT NOT NULL,
    subject_id INT NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY attendance_sessions_schedule_date_unique (schedule_id, session_date),
    KEY attendance_sessions_teacher_date_idx (teacher_id, session_date),
    KEY attendance_sessions_class_date_idx (class_level_id, session_date),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE RESTRICT,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS student_absences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    attendance_session_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    status ENUM('ABSENT', 'EXCUSED') NOT NULL DEFAULT 'ABSENT',
    reason VARCHAR(255) NULL,
    note VARCHAR(500) NULL,
    recorded_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY student_absences_session_enrollment_unique (attendance_session_id, enrollment_id),
    KEY student_absences_enrollment_idx (enrollment_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
);
