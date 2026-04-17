SET @add_schools_slug := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'schools' AND column_name = 'slug'
    ),
    'SELECT 1',
    'ALTER TABLE schools ADD COLUMN slug VARCHAR(160) NULL AFTER name'
  )
);
PREPARE stmt_add_schools_slug FROM @add_schools_slug;
EXECUTE stmt_add_schools_slug;
DEALLOCATE PREPARE stmt_add_schools_slug;

SET @add_schools_email_domain := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'schools' AND column_name = 'email_domain'
    ),
    'SELECT 1',
    'ALTER TABLE schools ADD COLUMN email_domain VARCHAR(160) NULL AFTER slug'
  )
);
PREPARE stmt_add_schools_email_domain FROM @add_schools_email_domain;
EXECUTE stmt_add_schools_email_domain;
DEALLOCATE PREPARE stmt_add_schools_email_domain;

SET @add_schools_logo_path := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'schools' AND column_name = 'logo_path'
    ),
    'SELECT 1',
    'ALTER TABLE schools ADD COLUMN logo_path VARCHAR(255) NULL AFTER email_domain'
  )
);
PREPARE stmt_add_schools_logo_path FROM @add_schools_logo_path;
EXECUTE stmt_add_schools_logo_path;
DEALLOCATE PREPARE stmt_add_schools_logo_path;

UPDATE schools
SET slug = LOWER(REPLACE(TRIM(name), ' ', '-'))
WHERE slug IS NULL OR slug = '';

UPDATE schools
SET email_domain = CONCAT(slug, '.com')
WHERE email_domain IS NULL OR email_domain = '';

ALTER TABLE schools
MODIFY slug VARCHAR(160) NOT NULL,
MODIFY email_domain VARCHAR(160) NOT NULL;

SET @idx_slug := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'schools' AND index_name = 'schools_slug_unique'),
    'SELECT 1',
    'ALTER TABLE schools ADD UNIQUE INDEX schools_slug_unique (slug)'
  )
);
PREPARE stmt_slug FROM @idx_slug;
EXECUTE stmt_slug;
DEALLOCATE PREPARE stmt_slug;

SET @idx_domain := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'schools' AND index_name = 'schools_email_domain_unique'),
    'SELECT 1',
    'ALTER TABLE schools ADD UNIQUE INDEX schools_email_domain_unique (email_domain)'
  )
);
PREPARE stmt_domain FROM @idx_domain;
EXECUTE stmt_domain;
DEALLOCATE PREPARE stmt_domain;

SET @add_users_school_id := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'school_id'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN school_id INT NULL AFTER role'
  )
);
PREPARE stmt_add_users_school_id FROM @add_users_school_id;
EXECUTE stmt_add_users_school_id;
DEALLOCATE PREPARE stmt_add_users_school_id;

ALTER TABLE users
MODIFY role ENUM('super_admin', 'admin', 'accountant') NOT NULL DEFAULT 'accountant';

SET @idx_users_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_school_id_idx'),
    'SELECT 1',
    'ALTER TABLE users ADD INDEX users_school_id_idx (school_id)'
  )
);
PREPARE stmt_idx_users_school FROM @idx_users_school;
EXECUTE stmt_idx_users_school;
DEALLOCATE PREPARE stmt_idx_users_school;

SET @fk_users_school := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND constraint_name = 'users_school_id_fk'),
    'SELECT 1',
    'ALTER TABLE users ADD CONSTRAINT users_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL'
  )
);
PREPARE stmt_fk_users_school FROM @fk_users_school;
EXECUTE stmt_fk_users_school;
DEALLOCATE PREPARE stmt_fk_users_school;
