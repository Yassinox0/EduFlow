SET @school_email_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'email');
SET @school_email_sql := IF(@school_email_exists = 0, 'ALTER TABLE schools ADD COLUMN email VARCHAR(150) NULL AFTER phone', 'SELECT 1');
PREPARE school_email_statement FROM @school_email_sql;
EXECUTE school_email_statement;
DEALLOCATE PREPARE school_email_statement;
