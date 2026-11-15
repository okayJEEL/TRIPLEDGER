-- TripLedger Migration 002: Explicit Grants & Strict Row Level Security (RLS)
-- Enforces Admin full access and Faculty strictly read-only at the database level.

-- 1. Role Lookup Helper Functions (SECURITY DEFINER avoids infinite RLS recursion on profiles)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_authorized_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'faculty_viewer')
  );
$$;

-- Prevent non-privileged role self-escalation on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'Insufficient privileges to alter user role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- 2. Explicit Table Grants (No anonymous access)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Profiles: authenticated users can read own profile (and admin reads all via RLS); update own name
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Financial tables: SELECT for authenticated (admin & faculty_viewer), write operations granted ONLY to authenticated and strictly gated by is_admin() RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_settings TO authenticated;

-- Audit Logs: Strictly read-only (populated exclusively by SECURITY DEFINER triggers)
GRANT SELECT ON public.audit_logs TO authenticated;

-- 3. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- PARTICIPANTS
DROP POLICY IF EXISTS "participants_select_authorized" ON public.participants;
CREATE POLICY "participants_select_authorized"
  ON public.participants FOR SELECT TO authenticated
  USING (public.is_authorized_member());

DROP POLICY IF EXISTS "participants_insert_admin" ON public.participants;
CREATE POLICY "participants_insert_admin"
  ON public.participants FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "participants_update_admin" ON public.participants;
CREATE POLICY "participants_update_admin"
  ON public.participants FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "participants_delete_admin" ON public.participants;
CREATE POLICY "participants_delete_admin"
  ON public.participants FOR DELETE TO authenticated
  USING (public.is_admin());

-- INCOME TRANSACTIONS
DROP POLICY IF EXISTS "income_select_authorized" ON public.income_transactions;
CREATE POLICY "income_select_authorized"
  ON public.income_transactions FOR SELECT TO authenticated
  USING (public.is_authorized_member());

DROP POLICY IF EXISTS "income_insert_admin" ON public.income_transactions;
CREATE POLICY "income_insert_admin"
  ON public.income_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "income_update_admin" ON public.income_transactions;
CREATE POLICY "income_update_admin"
  ON public.income_transactions FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "income_delete_admin" ON public.income_transactions;
CREATE POLICY "income_delete_admin"
  ON public.income_transactions FOR DELETE TO authenticated
  USING (public.is_admin());

-- EXPENSE TRANSACTIONS
DROP POLICY IF EXISTS "expense_select_authorized" ON public.expense_transactions;
CREATE POLICY "expense_select_authorized"
  ON public.expense_transactions FOR SELECT TO authenticated
  USING (public.is_authorized_member());

DROP POLICY IF EXISTS "expense_insert_admin" ON public.expense_transactions;
CREATE POLICY "expense_insert_admin"
  ON public.expense_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "expense_update_admin" ON public.expense_transactions;
CREATE POLICY "expense_update_admin"
  ON public.expense_transactions FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "expense_delete_admin" ON public.expense_transactions;
CREATE POLICY "expense_delete_admin"
  ON public.expense_transactions FOR DELETE TO authenticated
  USING (public.is_admin());

-- BUDGET SETTINGS
DROP POLICY IF EXISTS "budget_settings_select_authorized" ON public.budget_settings;
CREATE POLICY "budget_settings_select_authorized"
  ON public.budget_settings FOR SELECT TO authenticated
  USING (public.is_authorized_member());

DROP POLICY IF EXISTS "budget_settings_insert_admin" ON public.budget_settings;
CREATE POLICY "budget_settings_insert_admin"
  ON public.budget_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "budget_settings_update_admin" ON public.budget_settings;
CREATE POLICY "budget_settings_update_admin"
  ON public.budget_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "budget_settings_delete_admin" ON public.budget_settings;
CREATE POLICY "budget_settings_delete_admin"
  ON public.budget_settings FOR DELETE TO authenticated
  USING (public.is_admin());

-- AUDIT LOGS (Strictly Admin read-only; no insert/update/delete policies for users)
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());
