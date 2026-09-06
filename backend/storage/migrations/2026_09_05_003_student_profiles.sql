SET @add_student_photo_path := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'students'
              AND column_name = 'photo_path'
        ),
        'SELECT 1',
        'ALTER TABLE students ADD COLUMN photo_path VARCHAR(255) NULL AFTER gender'
    )
);
PREPARE stmt_add_student_photo_path FROM @add_student_photo_path;
EXECUTE stmt_add_student_photo_path;
DEALLOCATE PREPARE stmt_add_student_photo_path;
