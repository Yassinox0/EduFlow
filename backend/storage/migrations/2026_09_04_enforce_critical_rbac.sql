INSERT IGNORE INTO permissions (code, label) VALUES
('personnel.view','Consulter le personnel'),('personnel.manage','Gérer le personnel'),
('payments.view','Consulter les paiements'),('payments.create','Créer les paiements'),('payments.update','Modifier les paiements'),('payments.delete','Supprimer les paiements'),('payments.export','Exporter les paiements'),
('monthly_fees.view','Consulter les mensualités'),('monthly_fees.manage','Gérer les mensualités'),
('classes.view','Consulter les classes'),('classes.manage','Gérer les classes'),
('schedules.view','Consulter les emplois du temps'),('schedules.manage','Gérer les emplois du temps'),
('teachers.view','Consulter les professeurs'),('teachers.manage','Gérer les professeurs');

INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

UPDATE users u SET role = 'professeur'
WHERE u.role = 'user' AND (
  EXISTS (SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id = u.id)
  OR EXISTS (SELECT 1 FROM teacher_class_levels tcl WHERE tcl.teacher_id = u.id)
  OR EXISTS (SELECT 1 FROM schedules sc WHERE sc.teacher_id = u.id)
);
