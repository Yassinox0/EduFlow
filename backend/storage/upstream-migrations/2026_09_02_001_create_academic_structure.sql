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

INSERT IGNORE INTO academic_years (school_id, name, is_current, status)
SELECT legacy_years.school_id, legacy_years.name, 0, 'CLOSED'
FROM (
    SELECT school_id, TRIM(school_year) AS name
    FROM students
    WHERE school_year IS NOT NULL AND TRIM(school_year) <> ''
    UNION
    SELECT school_id, TRIM(school_year) AS name
    FROM class_levels
    WHERE school_year IS NOT NULL AND TRIM(school_year) <> ''
) AS legacy_years;

INSERT IGNORE INTO academic_years (school_id, name, is_current, status)
SELECT
    schools.id,
    CONCAT(
        IF(MONTH(CURRENT_DATE()) >= 9, YEAR(CURRENT_DATE()), YEAR(CURRENT_DATE()) - 1),
        '-',
        IF(MONTH(CURRENT_DATE()) >= 9, YEAR(CURRENT_DATE()) + 1, YEAR(CURRENT_DATE()))
    ),
    1,
    'ACTIVE'
FROM schools
WHERE NOT EXISTS (
    SELECT 1
    FROM academic_years
    WHERE academic_years.school_id = schools.id
);

UPDATE academic_years
SET is_current = 0,
    status = CASE WHEN status = 'ACTIVE' THEN 'CLOSED' ELSE status END
WHERE is_current = 1;

UPDATE academic_years academic_year
INNER JOIN (
    SELECT school_id, MAX(name) AS latest_name
    FROM academic_years
    GROUP BY school_id
) latest
    ON latest.school_id = academic_year.school_id
   AND latest.latest_name = academic_year.name
SET academic_year.is_current = 1,
    academic_year.status = 'ACTIVE';

INSERT IGNORE INTO enrollments (
    school_id,
    academic_year_id,
    student_id,
    class_level_id,
    enrollment_date,
    status
)
SELECT
    student.school_id,
    COALESCE(named_year.id, current_year.id),
    student.id,
    student.class_level_id,
    COALESCE(DATE(student.created_at), CURRENT_DATE()),
    CASE WHEN student.status = 'ACTIVE' THEN 'ACTIVE' ELSE 'WITHDRAWN' END
FROM students student
LEFT JOIN academic_years named_year
    ON named_year.school_id = student.school_id
   AND named_year.name = NULLIF(TRIM(student.school_year), '')
LEFT JOIN academic_years current_year
    ON current_year.school_id = student.school_id
   AND current_year.is_current = 1
WHERE student.class_level_id IS NOT NULL
  AND COALESCE(named_year.id, current_year.id) IS NOT NULL;

INSERT IGNORE INTO teacher_assignments (
    school_id,
    academic_year_id,
    teacher_id,
    subject_id,
    class_level_id,
    weekly_hours,
    status
)
SELECT
    teacher.school_id,
    academic_year.id,
    teacher.id,
    teacher_subject.subject_id,
    teacher_class.class_level_id,
    COALESCE(subject_class.weekly_hours, 0),
    'ACTIVE'
FROM users teacher
INNER JOIN teacher_class_levels teacher_class
    ON teacher_class.teacher_id = teacher.id
INNER JOIN class_levels class_level
    ON class_level.id = teacher_class.class_level_id
   AND class_level.school_id = teacher.school_id
INNER JOIN teacher_subjects teacher_subject
    ON teacher_subject.teacher_id = teacher.id
INNER JOIN academic_years academic_year
    ON academic_year.school_id = teacher.school_id
   AND academic_year.is_current = 1
LEFT JOIN subject_class_levels subject_class
    ON subject_class.subject_id = teacher_subject.subject_id
   AND subject_class.class_level_id = teacher_class.class_level_id
WHERE teacher.role IN ('professeur', 'user');

INSERT IGNORE INTO teacher_assignments (
    school_id,
    academic_year_id,
    teacher_id,
    subject_id,
    class_level_id,
    weekly_hours,
    status
)
SELECT
    schedule.school_id,
    academic_year.id,
    schedule.teacher_id,
    schedule.subject_id,
    schedule.class_level_id,
    COALESCE(subject_class.weekly_hours, 0),
    'ACTIVE'
FROM schedules schedule
INNER JOIN academic_years academic_year
    ON academic_year.school_id = schedule.school_id
   AND academic_year.is_current = 1
LEFT JOIN subject_class_levels subject_class
    ON subject_class.subject_id = schedule.subject_id
   AND subject_class.class_level_id = schedule.class_level_id
WHERE schedule.teacher_id IS NOT NULL
  AND schedule.subject_id IS NOT NULL
  AND schedule.class_level_id IS NOT NULL
  AND schedule.is_external = 0;
