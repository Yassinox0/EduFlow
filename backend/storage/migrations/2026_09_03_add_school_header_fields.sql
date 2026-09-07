SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'schools' AND column_name = 'phone_secondary'),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN phone_secondary VARCHAR(30) NULL AFTER phone'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'schools' AND column_name = 'website'),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN website VARCHAR(255) NULL AFTER email'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'schools' AND column_name = 'administrative_info'),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN administrative_info VARCHAR(500) NULL AFTER website'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;
