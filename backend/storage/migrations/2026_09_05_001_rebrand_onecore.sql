UPDATE users
SET
    last_name = 'OneCore',
    email = CASE
        WHEN email = 'owner@eduflow.com' THEN 'owner@onecore.local'
        WHEN email = 'superadmin@eduflow.com' THEN 'superadmin@onecore.local'
        ELSE email
    END
WHERE role = 'super_admin'
  AND email IN ('owner@eduflow.com', 'superadmin@eduflow.com');
