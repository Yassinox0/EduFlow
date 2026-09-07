SET @add_receipt_number := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'receipt_number'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD COLUMN receipt_number VARCHAR(40) NULL AFTER monthly_fee_id'
    )
);
PREPARE stmt_add_receipt_number FROM @add_receipt_number;
EXECUTE stmt_add_receipt_number;
DEALLOCATE PREPARE stmt_add_receipt_number;

SET @add_fee_total_snapshot := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'fee_total_at_payment'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD COLUMN fee_total_at_payment DECIMAL(10,2) NULL AFTER amount_paid'
    )
);
PREPARE stmt_add_fee_total_snapshot FROM @add_fee_total_snapshot;
EXECUTE stmt_add_fee_total_snapshot;
DEALLOCATE PREPARE stmt_add_fee_total_snapshot;

SET @add_paid_before_snapshot := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'paid_before_payment'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD COLUMN paid_before_payment DECIMAL(10,2) NULL AFTER fee_total_at_payment'
    )
);
PREPARE stmt_add_paid_before_snapshot FROM @add_paid_before_snapshot;
EXECUTE stmt_add_paid_before_snapshot;
DEALLOCATE PREPARE stmt_add_paid_before_snapshot;

SET @add_remaining_after_snapshot := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'remaining_after_payment'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD COLUMN remaining_after_payment DECIMAL(10,2) NULL AFTER paid_before_payment'
    )
);
PREPARE stmt_add_remaining_after_snapshot FROM @add_remaining_after_snapshot;
EXECUTE stmt_add_remaining_after_snapshot;
DEALLOCATE PREPARE stmt_add_remaining_after_snapshot;

SET @add_issued_by := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'issued_by_user_id'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD COLUMN issued_by_user_id INT NULL AFTER payment_method'
    )
);
PREPARE stmt_add_issued_by FROM @add_issued_by;
EXECUTE stmt_add_issued_by;
DEALLOCATE PREPARE stmt_add_issued_by;

UPDATE payments p
INNER JOIN monthly_fees mf ON mf.id = p.monthly_fee_id
INNER JOIN schools sch ON sch.id = p.school_id
LEFT JOIN (
    SELECT
        current_payment.id AS payment_id,
        COALESCE(SUM(previous_payment.amount_paid), 0) AS paid_before
    FROM payments current_payment
    LEFT JOIN payments previous_payment
        ON previous_payment.monthly_fee_id = current_payment.monthly_fee_id
       AND (
            previous_payment.payment_date < current_payment.payment_date
            OR (
                previous_payment.payment_date = current_payment.payment_date
                AND previous_payment.id < current_payment.id
            )
       )
    GROUP BY current_payment.id
) history ON history.payment_id = p.id
SET
    p.receipt_number = COALESCE(
        p.receipt_number,
        CONCAT(UPPER(REPLACE(sch.code, ' ', '-')), '-', YEAR(p.payment_date), '-', LPAD(p.id, 6, '0'))
    ),
    p.fee_total_at_payment = COALESCE(p.fee_total_at_payment, mf.total_amount),
    p.paid_before_payment = COALESCE(p.paid_before_payment, history.paid_before),
    p.remaining_after_payment = COALESCE(
        p.remaining_after_payment,
        GREATEST(0, mf.total_amount - history.paid_before - p.amount_paid)
    );

SET @add_receipt_unique := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.statistics
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND index_name = 'payments_school_receipt_unique'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD UNIQUE KEY payments_school_receipt_unique (school_id, receipt_number)'
    )
);
PREPARE stmt_add_receipt_unique FROM @add_receipt_unique;
EXECUTE stmt_add_receipt_unique;
DEALLOCATE PREPARE stmt_add_receipt_unique;

SET @add_issued_by_fk := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_schema = DATABASE()
              AND table_name = 'payments'
              AND constraint_name = 'payments_issued_by_user_fk'
        ),
        'SELECT 1',
        'ALTER TABLE payments ADD CONSTRAINT payments_issued_by_user_fk FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE SET NULL'
    )
);
PREPARE stmt_add_issued_by_fk FROM @add_issued_by_fk;
EXECUTE stmt_add_issued_by_fk;
DEALLOCATE PREPARE stmt_add_issued_by_fk;
