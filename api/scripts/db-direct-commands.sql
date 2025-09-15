-- Promote existing user to superadmin
UPDATE users SET role = 'superadmin', active = true WHERE email = 'YOUR_EMAIL_HERE';

-- Create new superadmin account
INSERT INTO users (email, password_hash, role, active) 
VALUES (
  'superadmin@yourcompany.com', 
  '$2a$12$LQv3c1yqBWKaecW7CKrZneWcQPGnXRwChucJGf2zt8qO4gOJJgJ9G', 
  'superadmin', 
  true
);

-- List all users and roles
SELECT id, email, role, active, created_at FROM users ORDER BY id;

-- Remove emergency account
DELETE FROM users WHERE email = 'emergency.superadmin@system.local';