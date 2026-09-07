-- Phase 2: responsables multiples et dossiers familiaux.
CREATE TABLE IF NOT EXISTS guardians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    legacy_parent_id INT NULL,
    full_name VARCHAR(180) NOT NULL,
    phone_primary VARCHAR(30) NULL,
    phone_secondary VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    cin VARCHAR(80) NULL,
    address VARCHAR(255) NULL,
    profession VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY guardians_legacy_parent_unique (legacy_parent_id),
    KEY guardians_school_phone_idx (school_id, phone_primary),
    CONSTRAINT guardians_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT guardians_legacy_parent_fk FOREIGN KEY (legacy_parent_id) REFERENCES parents(id) ON DELETE SET NULL
);

INSERT IGNORE INTO guardians (school_id, legacy_parent_id, full_name, phone_primary, email)
SELECT p.school_id, p.id, TRIM(CONCAT(p.first_name, ' ', p.last_name)), p.phone, p.email FROM parents p;

CREATE TABLE IF NOT EXISTS families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    family_reference VARCHAR(80) NOT NULL,
    family_name VARCHAR(180) NOT NULL,
    primary_guardian_id INT NULL,
    address VARCHAR(255) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY families_school_reference_unique (school_id, family_reference),
    KEY families_school_name_idx (school_id, family_name),
    CONSTRAINT families_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT families_primary_guardian_fk FOREIGN KEY (primary_guardian_id) REFERENCES guardians(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_guardians (
    student_id INT NOT NULL,
    guardian_id INT NOT NULL,
    school_id INT NOT NULL,
    relationship_type VARCHAR(80) NOT NULL,
    is_financial_responsible TINYINT(1) NOT NULL DEFAULT 0,
    is_emergency_contact TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, guardian_id),
    KEY student_guardians_school_guardian_idx (school_id, guardian_id),
    CONSTRAINT student_guardians_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT student_guardians_guardian_fk FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE,
    CONSTRAINT student_guardians_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

INSERT IGNORE INTO student_guardians (student_id, guardian_id, school_id, relationship_type, is_financial_responsible, is_emergency_contact)
SELECT s.id, g.id, s.school_id, 'Responsable historique', 1, 1
FROM students s INNER JOIN guardians g ON g.legacy_parent_id = s.parent_id AND g.school_id = s.school_id
WHERE s.parent_id IS NOT NULL;

ALTER TABLE students ADD COLUMN family_id INT NULL AFTER parent_id;
ALTER TABLE students ADD KEY students_family_id_idx (family_id);
ALTER TABLE students ADD CONSTRAINT students_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;
