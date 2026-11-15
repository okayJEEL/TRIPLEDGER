-- TripLedger Account Linking Template
-- Step 1: In Supabase Dashboard -> Authentication -> Users -> Add user (Create new user):
--         Create User 1 (Admin - Jeel Parmar) with a strong password and Auto-Confirm User checked.
--         Create User 2 (Faculty Viewer) with a strong password and Auto-Confirm User checked.
-- Step 2: Replace the placeholder emails below with the exact emails you created in Authentication -> Users
--         and run this query in Supabase SQL Editor.

INSERT INTO public.profiles (id, full_name, email, role)
SELECT id, 'Jeel Parmar', email, 'admin'
FROM auth.users
WHERE lower(email) = lower('jeel.parmar.1104@gmail.com')
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = 'admin';

INSERT INTO public.profiles (id, full_name, email, role)
SELECT id, 'Faculty Viewer', email, 'faculty_viewer'
FROM auth.users
WHERE lower(email) = lower('REPLACE_WITH_FACULTY_EMAIL@example.com')
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = 'faculty_viewer';
