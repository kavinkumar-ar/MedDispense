-- Confirm the existing user's email manually
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'kavinraj@gmail.com';
