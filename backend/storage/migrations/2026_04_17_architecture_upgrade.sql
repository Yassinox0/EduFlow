-- schools columns
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='code'),'SELECT 1','ALTER TABLE schools ADD COLUMN code VARCHAR(50) NULL AFTER name')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='slug'),'SELECT 1','ALTER TABLE schools ADD COLUMN slug VARCHAR(160) NULL AFTER code')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='email_domain'),'SELECT 1','ALTER TABLE schools ADD COLUMN email_domain VARCHAR(160) NULL AFTER slug')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='logo_path'),'SELECT 1','ALTER TABLE schools ADD COLUMN logo_path VARCHAR(255) NULL AFTER email_domain')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='phone'),'SELECT 1','ALTER TABLE schools ADD COLUMN phone VARCHAR(30) NULL AFTER logo_path')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='address'),'SELECT 1','ALTER TABLE schools ADD COLUMN address VARCHAR(255) NULL AFTER phone')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='city'),'SELECT 1','ALTER TABLE schools ADD COLUMN city VARCHAR(100) NULL AFTER address')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='country'),'SELECT 1','ALTER TABLE schools ADD COLUMN country VARCHAR(100) NULL AFTER city')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='primary_color'),'SELECT 1','ALTER TABLE schools ADD COLUMN primary_color VARCHAR(20) NOT NULL DEFAULT ''#1E3A8A'' AFTER country')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='secondary_color'),'SELECT 1','ALTER TABLE schools ADD COLUMN secondary_color VARCHAR(20) NOT NULL DEFAULT ''#22C55E'' AFTER primary_color')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='currency'),'SELECT 1','ALTER TABLE schools ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT ''MAD'' AFTER secondary_color')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='schools' AND column_name='status'),'SELECT 1','ALTER TABLE schools ADD COLUMN status ENUM(''ACTIVE'',''INACTIVE'') NOT NULL DEFAULT ''ACTIVE'' AFTER currency')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE schools SET code = UPPER(LEFT(REPLACE(REPLACE(REPLACE(TRIM(name), ' ', ''), '-', ''), '_', ''), 10)) WHERE code IS NULL OR code = '';
UPDATE schools SET slug = LOWER(REPLACE(TRIM(name), ' ', '-')) WHERE slug IS NULL OR slug = '';
UPDATE schools SET email_domain = CONCAT(slug, '.com') WHERE email_domain IS NULL OR email_domain = '';

ALTER TABLE schools MODIFY code VARCHAR(50) NOT NULL, MODIFY slug VARCHAR(160) NOT NULL, MODIFY email_domain VARCHAR(160) NOT NULL;

SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='schools' AND index_name='schools_code_unique'),'SELECT 1','ALTER TABLE schools ADD UNIQUE INDEX schools_code_unique (code)')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='schools' AND index_name='schools_slug_unique'),'SELECT 1','ALTER TABLE schools ADD UNIQUE INDEX schools_slug_unique (slug)')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='schools' AND index_name='schools_email_domain_unique'),'SELECT 1','ALTER TABLE schools ADD UNIQUE INDEX schools_email_domain_unique (email_domain)')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- users columns and role/status
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='first_name'),'SELECT 1','ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL AFTER school_id')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='last_name'),'SELECT 1','ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='status'),'SELECT 1','ALTER TABLE users ADD COLUMN status ENUM(''ACTIVE'',''INACTIVE'') NOT NULL DEFAULT ''ACTIVE'' AFTER role')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='school_id'),'SELECT 1','ALTER TABLE users ADD COLUMN school_id INT NULL AFTER role')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE users SET first_name = 'System' WHERE first_name IS NULL OR first_name='';
UPDATE users SET last_name = 'User' WHERE last_name IS NULL OR last_name='';
UPDATE users SET role = 'user' WHERE role='accountant';

ALTER TABLE users MODIFY first_name VARCHAR(100) NOT NULL, MODIFY last_name VARCHAR(100) NOT NULL;
ALTER TABLE users MODIFY role ENUM('super_admin','admin','user','consultant') NOT NULL;

SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name='users_school_id_idx'),'SELECT 1','ALTER TABLE users ADD INDEX users_school_id_idx (school_id)')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET @q := (SELECT IF(EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND constraint_name='users_school_id_fk'),'SELECT 1','ALTER TABLE users ADD CONSTRAINT users_school_id_fk FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL')); PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
