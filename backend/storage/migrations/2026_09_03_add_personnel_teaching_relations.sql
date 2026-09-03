CREATE TABLE IF NOT EXISTS personnel_subjects (
    personnel_id INT NOT NULL,
    school_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (personnel_id, subject_id),
    KEY personnel_subjects_school_idx (school_id),
    KEY personnel_subjects_subject_idx (subject_id),
    CONSTRAINT personnel_subjects_personnel_fk FOREIGN KEY (personnel_id) REFERENCES personnel_profiles(id) ON DELETE CASCADE,
    CONSTRAINT personnel_subjects_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT personnel_subjects_subject_fk FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS personnel_class_levels (
    personnel_id INT NOT NULL,
    school_id INT NOT NULL,
    class_level_id INT NOT NULL,
    PRIMARY KEY (personnel_id, class_level_id),
    KEY personnel_class_levels_school_idx (school_id),
    KEY personnel_class_levels_level_idx (class_level_id),
    CONSTRAINT personnel_class_levels_personnel_fk FOREIGN KEY (personnel_id) REFERENCES personnel_profiles(id) ON DELETE CASCADE,
    CONSTRAINT personnel_class_levels_school_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT personnel_class_levels_level_fk FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE CASCADE
);
