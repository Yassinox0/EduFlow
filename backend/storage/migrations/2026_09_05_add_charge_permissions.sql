INSERT IGNORE INTO permissions (code, label) VALUES
('charges.view', 'Consulter les charges élèves'),
('charges.manage', 'Gérer les charges élèves'),
('discounts.manage', 'Gérer les réductions élèves');

INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE code IN ('charges.view','charges.manage','discounts.manage');
