USE salma_project;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE payments;
TRUNCATE TABLE monthly_fees;
TRUNCATE TABLE students;
TRUNCATE TABLE parents;
TRUNCATE TABLE class_levels;
TRUNCATE TABLE users;
TRUNCATE TABLE schools;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO schools (
    id, name, code, slug, email_domain, logo_path, phone, address, city, country,
    primary_color, secondary_color, currency, status, created_at
) VALUES (
    1,
    'MIRANDA',
    '1',
    'op',
    'miranda.com',
    'uploads/schools/school_1776385102_57883210.jpg',
    '0619132824',
    'VILLA NR 30 LOT LES PLIADS BERRECHID',
    'BERRECHID',
    'Maroc',
    '#1E3A8A',
    '#22C55E',
    'MAD',
    'ACTIVE',
    '2026-04-17 00:18:22'
);

INSERT INTO users (
    id, school_id, first_name, last_name, email, password, role, status, created_at
) VALUES
(
    1,
    NULL,
    'Owner',
    'OneCore',
    'owner@onecore.local',
    '$2y$10$XqC2r7yA1DsOZLbOT26c7.BjeIZwBCaQkw7ARzfSjThu29oLdhw06',
    'super_admin',
    'ACTIVE',
    '2026-04-16 23:42:55'
),
(
    2,
    1,
    'YASSINE',
    'BENMANSOUR',
    'yassine.benmansour@miranda.com',
    '$2y$10$ad5cZzLMfaVB7sCADtZZfeXrtK0nTFRGmgms3axprgTB0UFG6usvm',
    'admin',
    'ACTIVE',
    '2026-04-17 00:18:59'
),
(
    3,
    1,
    'SALMA',
    'RAHIB',
    'salma@miranda.com',
    '$2y$10$5HZsl1k1Q4UExS9snyvIf.0U0kZhKwALthjKt3r0Fn0i8vBK1AzMS',
    'user',
    'ACTIVE',
    '2026-05-11 19:40:44'
);

ALTER TABLE schools AUTO_INCREMENT = 2;
ALTER TABLE users AUTO_INCREMENT = 4;
