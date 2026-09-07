-- Référentiels Miranda : aucun élève n'est créé par cette migration.
INSERT INTO class_levels (school_id,name,code,level_name,group_name,school_year,sort_order,status)
SELECT s.id, v.level_name, v.level_name, v.level_name, NULL, '2026/2027', v.sort_order, 'ACTIVE'
FROM schools s
JOIN (
 SELECT 'P.S' level_name, 20 sort_order UNION ALL SELECT 'M.S',21 UNION ALL SELECT 'G.S',22
 UNION ALL SELECT 'CP',30 UNION ALL SELECT 'CE1',31 UNION ALL SELECT 'CE2',32
 UNION ALL SELECT 'CM1',33 UNION ALL SELECT 'CM2',34 UNION ALL SELECT '6AP',35
) v
WHERE UPPER(s.name)='MIRANDA'
ON DUPLICATE KEY UPDATE level_name=VALUES(level_name),school_year=VALUES(school_year),status='ACTIVE';

INSERT INTO level_fee_prices (school_id,class_level_id,school_year,monthly_amount,transport_amount,registration_insurance_amount)
SELECT cl.school_id,cl.id,cl.school_year,
 CASE WHEN cl.level_name IN ('P.S','M.S','G.S') THEN 800 WHEN cl.level_name IN ('CP','CE1','CE2') THEN 900 ELSE 1000 END,
 250,1100
FROM class_levels cl
JOIN schools s ON s.id=cl.school_id
WHERE UPPER(s.name)='MIRANDA' AND cl.school_year='2026/2027'
 AND cl.level_name IN ('P.S','M.S','G.S','CP','CE1','CE2','CM1','CM2','6AP')
ON DUPLICATE KEY UPDATE monthly_amount=VALUES(monthly_amount),transport_amount=VALUES(transport_amount),registration_insurance_amount=VALUES(registration_insurance_amount);
