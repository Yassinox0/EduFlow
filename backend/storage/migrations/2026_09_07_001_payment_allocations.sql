-- Flexible-payment bridge. Monthly-fee payments remain fully supported.
SET @schema_name := DATABASE();

SET @sql := IF(
    (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'monthly_fee_id') = 'NO',
    'ALTER TABLE payments MODIFY monthly_fee_id INT NULL',
    'SELECT 1'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'status'),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN status ENUM(''COMPLETED'', ''CANCELLED'') NOT NULL DEFAULT ''COMPLETED'' AFTER payment_method'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'cancelled_at'),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN cancelled_at TIMESTAMP NULL AFTER status'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'cancelled_by_user_id'),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN cancelled_by_user_id INT NULL AFTER cancelled_at, ADD CONSTRAINT payments_cancelled_by_user_fk FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id) ON DELETE SET NULL'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'cancellation_reason'),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN cancellation_reason TEXT NULL AFTER cancelled_by_user_id'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payments' AND INDEX_NAME = 'payments_school_id_id_idx'),
    'SELECT 1',
    'ALTER TABLE payments ADD KEY payments_school_id_id_idx (school_id, id)'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @sql := IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'student_financial_items' AND INDEX_NAME = 'student_financial_items_school_id_id_idx'),
    'SELECT 1',
    'ALTER TABLE student_financial_items ADD KEY student_financial_items_school_id_id_idx (school_id, id)'
);
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

CREATE TABLE IF NOT EXISTS payment_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    payment_id INT NOT NULL,
    student_financial_item_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY payment_allocations_payment_item_unique (payment_id, student_financial_item_id),
    KEY payment_allocations_school_item_idx (school_id, student_financial_item_id),
    KEY payment_allocations_school_payment_idx (school_id, payment_id),
    CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0),
    CONSTRAINT payment_allocations_payment_school_fk
        FOREIGN KEY (school_id, payment_id) REFERENCES payments(school_id, id) ON DELETE CASCADE,
    CONSTRAINT payment_allocations_item_school_fk
        FOREIGN KEY (school_id, student_financial_item_id) REFERENCES student_financial_items(school_id, id) ON DELETE RESTRICT
);
