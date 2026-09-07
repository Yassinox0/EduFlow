ALTER TABLE users
    ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password,
    ADD COLUMN password_changed_at DATETIME NULL AFTER must_change_password,
    ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER password_changed_at,
    ADD COLUMN photo_path VARCHAR(255) NULL AFTER primary_school;

UPDATE users
SET must_change_password = 1
WHERE role = 'professeur';

CREATE TABLE grading_periods (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO grading_periods (school_id, academic_year_id, code, name, start_date, end_date)
SELECT school_id, id, 'SEMESTER_1', 'Semestre 1', start_date,
       CASE
           WHEN start_date IS NULL THEN NULL
           ELSE DATE_SUB(DATE_ADD(start_date, INTERVAL 6 MONTH), INTERVAL 1 DAY)
       END
FROM academic_years;

INSERT INTO grading_periods (school_id, academic_year_id, code, name, start_date, end_date)
SELECT school_id, id, 'SEMESTER_2', 'Semestre 2',
       CASE WHEN start_date IS NULL THEN NULL ELSE DATE_ADD(start_date, INTERVAL 6 MONTH) END,
       end_date
FROM academic_years;

CREATE TABLE assessments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_grades (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grade_history (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_sessions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_absences (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
