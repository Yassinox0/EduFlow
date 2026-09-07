CREATE TABLE IF NOT EXISTS level_fee_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    class_level_id INT NOT NULL,
    school_year VARCHAR(20) NULL,
    monthly_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    transport_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    registration_insurance_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY level_fee_prices_unique (school_id,class_level_id,school_year),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE CASCADE
);

-- Grille fournie par Miranda; elle reste modifiable en base pour chaque établissement et année.
INSERT INTO level_fee_prices (school_id,class_level_id,school_year,monthly_amount,transport_amount,registration_insurance_amount)
SELECT cl.school_id,cl.id,cl.school_year,
 CASE
  WHEN UPPER(cl.level_name) IN ('1AC','2AC','3AC') THEN 1300
  WHEN UPPER(cl.level_name)='TC' THEN 1600
  WHEN UPPER(cl.level_name)='1BAC' AND LOWER(COALESCE(cl.group_name,'')) LIKE '%math%' THEN 2050
  WHEN UPPER(cl.level_name)='1BAC' THEN 1900
  WHEN UPPER(cl.level_name)='2BAC' THEN 2200
  ELSE 0 END,
 250,1100
FROM class_levels cl
WHERE cl.school_id=(SELECT id FROM schools WHERE UPPER(name)='MIRANDA' LIMIT 1)
  AND UPPER(cl.level_name) IN ('1AC','2AC','3AC','TC','1BAC','2BAC')
ON DUPLICATE KEY UPDATE monthly_amount=VALUES(monthly_amount),transport_amount=VALUES(transport_amount),registration_insurance_amount=VALUES(registration_insurance_amount);
