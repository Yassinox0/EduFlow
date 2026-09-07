-- P.S est retirée à la demande; vérifiée sans élève associé avant exécution.
DELETE cl FROM class_levels cl
JOIN schools s ON s.id=cl.school_id
WHERE UPPER(s.name)='MIRANDA' AND cl.level_name='P.S';

UPDATE academic_years ay
JOIN schools s ON s.id=ay.school_id
SET ay.label='2026/2027'
WHERE UPPER(s.name)='MIRANDA' AND ay.label='2026-2027';
