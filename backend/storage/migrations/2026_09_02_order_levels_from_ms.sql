UPDATE class_levels cl
JOIN schools s ON s.id=cl.school_id
SET cl.sort_order = CASE
 WHEN cl.level_name='M.S' THEN 1 WHEN cl.level_name='G.S' THEN 2
 WHEN cl.level_name='CP' THEN 3 WHEN cl.level_name='CE1' THEN 4 WHEN cl.level_name='CE2' THEN 5
 WHEN cl.level_name='CM1' THEN 6 WHEN cl.level_name='CM2' THEN 7 WHEN cl.level_name='6AP' THEN 8
 WHEN UPPER(cl.level_name)='1AC' THEN 20 WHEN UPPER(cl.level_name)='2AC' THEN 30
 WHEN UPPER(cl.level_name)='3AC' THEN 40 WHEN UPPER(cl.level_name)='TC' THEN 50
 WHEN UPPER(cl.level_name)='1BAC' THEN 60 WHEN UPPER(cl.level_name)='2BAC' THEN 70
 ELSE cl.sort_order END
WHERE UPPER(s.name)='MIRANDA';
