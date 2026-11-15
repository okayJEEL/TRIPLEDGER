# Supabase Setup Instructions for TripLedger

Your application connects to your existing Supabase project (`https://iapqnpznadwsohjqbegu.supabase.co`). Because the frontend uses only the **publishable key**, database DDL migrations and initial account creation must be executed once inside the Supabase Dashboard.

## Step 1: Run SQL Migrations (Order Matters)

Open your project's **SQL Editor** in the Supabase Dashboard and run each file in `/supabase/migrations/` in exact order:

1. `supabase/migrations/001_initial_schema.sql`
   - Creates `profiles`, `participants`, `income_transactions`, `expense_transactions`, `budget_settings`, and `audit_logs`.
   - Adds foreign keys, validation constraints, indexes, automatic `STUxxx`/`FACxxx` code triggers, and automatic immutable audit log triggers.
2. `supabase/migrations/002_rls_and_grants.sql`
   - Revokes anonymous access (`anon`) from all financial tables.
   - Enables Row Level Security (`RLS`) across all tables.
   - Enforces `admin` write permissions and `faculty_viewer` strictly read-only permissions at the database API level.
3. `supabase/migrations/003_storage_and_realtime.sql`
   - Creates the private `trip-receipts` Storage bucket (`JPG`, `JPEG`, `PNG`, `PDF`, 10 MB limit).
   - Configures Storage RLS so Admin can upload/delete and Faculty Viewer can view/download signed URLs only.
   - Adds `participants`, `income_transactions`, `expense_transactions`, and `budget_settings` to the `supabase_realtime` publication.
4. `supabase/migrations/004_seed_initial_settings.sql`
   - Seeds the initial tour settings (`Maharashtra Western Ghats Study Tour`, `3 Dec 2026 – 12 Dec 2026`, `₹12,000` per person, `₹5,000` advance).
   - Seeds 33 numbered student slots (`STU001`–`STU033`) and 3 numbered faculty slots (`FAC001`–`FAC003`) without inventing fake names or transactions.

## Step 2: Create the Two User Accounts

1. Go to **Authentication -> Users -> Add user -> Create new user**.
2. Create **User 1 (Main Admin — Jeel Parmar)**:
   - Email: Jeel's login email address
   - Password: Enter a strong password securely
   - Check **Auto Confirm User**
3. Create **User 2 (Faculty Viewer)**:
   - Email: Faculty member's login email address
   - Password: Enter a strong password securely
   - Check **Auto Confirm User**
4. Recommended: Disable public signups under **Authentication -> Sign In / Providers -> User Signups** ("Allow new users to sign up" -> OFF) so unauthorized users cannot self-register.

## Step 3: Link User Roles in `public.profiles`

Run `supabase/migrations/005_link_accounts_template.sql` in **SQL Editor**, replacing the faculty email placeholder with the exact email you created in Step 2:

```sql
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
WHERE lower(email) = lower('faculty-email@example.com')
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = 'faculty_viewer';
```

## Step 4: Configure Password Reset Redirect URL

In **Authentication -> URL Configuration**:
- Add your application URL + `/reset-password` (e.g., `http://localhost:3000/reset-password` and your production URL `https://your-app.vercel.app/reset-password`) to **Redirect URLs**.
