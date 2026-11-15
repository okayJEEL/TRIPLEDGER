-- TripLedger Combined One-Shot Supabase Setup Script
-- Run this entire file once in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/iapqnpznadwsohjqbegu/sql/new

-- ============================================================================
-- PART 1: RELATIONAL SCHEMA, CONSTRAINTS, INDEXES & TRIGGERS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email text NOT NULL UNIQUE CHECK (position('@' in email) > 1),
  role text NOT NULL CHECK (role IN ('admin', 'faculty_viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_code text NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  participant_type text NOT NULL CHECK (participant_type IN ('student', 'faculty')),
  phone_number text,
  email text,
  total_budget numeric(12, 2) NOT NULL DEFAULT 12000.00 CHECK (total_budget >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.income_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference text NOT NULL UNIQUE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Other')),
  income_category text NOT NULL CHECK (
    income_category IN (
      'Advance Payment',
      'Remaining Payment',
      'Full Payment',
      'Additional Contribution',
      'Other Income'
    )
  ),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  receipt_file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference text NOT NULL UNIQUE,
  expense_title text NOT NULL CHECK (char_length(trim(expense_title)) >= 2),
  expense_category text NOT NULL CHECK (
    expense_category IN (
      'Accommodation',
      'Food and Refreshments',
      'Transportation',
      'Fuel',
      'Entry Tickets and Permits',
      'Research and Educational Activities',
      'Equipment and Materials',
      'Emergency Expenses',
      'Miscellaneous',
      'Other'
    )
  ),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Other')),
  vendor_or_payee text NOT NULL CHECK (char_length(trim(vendor_or_payee)) >= 1),
  description text,
  receipt_file_path text,
  entered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budget_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_name text NOT NULL CHECK (char_length(trim(trip_name)) >= 2),
  trip_start_date date NOT NULL,
  trip_end_date date NOT NULL,
  currency text NOT NULL DEFAULT 'INR' CHECK (char_length(trim(currency)) >= 1),
  budget_per_person numeric(12, 2) NOT NULL CHECK (budget_per_person >= 0),
  expected_advance numeric(12, 2) NOT NULL CHECK (expected_advance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_trip_dates CHECK (trip_end_date >= trip_start_date),
  CONSTRAINT valid_advance_amount CHECK (expected_advance <= budget_per_person)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_type_active ON public.participants(participant_type, is_active);
CREATE INDEX IF NOT EXISTS idx_participants_code ON public.participants(participant_code);
CREATE INDEX IF NOT EXISTS idx_income_participant_id ON public.income_transactions(participant_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON public.income_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_category ON public.expense_transactions(expense_category);
CREATE INDEX IF NOT EXISTS idx_expense_date ON public.expense_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_participants_updated_at ON public.participants;
CREATE TRIGGER trg_participants_updated_at BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_income_updated_at ON public.income_transactions;
CREATE TRIGGER trg_income_updated_at BEFORE UPDATE ON public.income_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_expense_updated_at ON public.expense_transactions;
CREATE TRIGGER trg_expense_updated_at BEFORE UPDATE ON public.expense_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_budget_settings_updated_at ON public.budget_settings;
CREATE TRIGGER trg_budget_settings_updated_at BEFORE UPDATE ON public.budget_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.generate_participant_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prefix text;
  next_num integer;
BEGIN
  IF NEW.participant_code IS NULL OR trim(NEW.participant_code) = '' THEN
    prefix := CASE WHEN NEW.participant_type = 'faculty' THEN 'FAC' ELSE 'STU' END;
    PERFORM pg_advisory_xact_lock(hashtext('participant_code_' || prefix));
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(participant_code, '^' || prefix, ''), '')::integer),
      0
    ) + 1
    INTO next_num
    FROM public.participants
    WHERE participant_code ~ ('^' || prefix || '[0-9]+$');

    NEW.participant_code := prefix || lpad(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participants_auto_code ON public.participants;
CREATE TRIGGER trg_participants_auto_code
  BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.generate_participant_code();

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  target_id uuid;
BEGIN
  actor_id := auth.uid();

  IF (TG_OP = 'DELETE') THEN
    target_id := OLD.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (actor_id, 'DELETE', TG_TABLE_NAME, target_id, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    target_id := NEW.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (actor_id, 'UPDATE', TG_TABLE_NAME, target_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    target_id := NEW.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (actor_id, 'INSERT', TG_TABLE_NAME, target_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_participants ON public.participants;
CREATE TRIGGER trg_audit_participants AFTER INSERT OR UPDATE OR DELETE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_income ON public.income_transactions;
CREATE TRIGGER trg_audit_income AFTER INSERT OR UPDATE OR DELETE ON public.income_transactions FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_expense ON public.expense_transactions;
CREATE TRIGGER trg_audit_expense AFTER INSERT OR UPDATE OR DELETE ON public.expense_transactions FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_budget_settings ON public.budget_settings;
CREATE TRIGGER trg_audit_budget_settings AFTER INSERT OR UPDATE OR DELETE ON public.budget_settings FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- ============================================================================
-- PART 2: EXPLICIT GRANTS & STRICT ROW LEVEL SECURITY (RLS)
-- ============================================================================
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

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_settings TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "participants_select_authorized" ON public.participants;
CREATE POLICY "participants_select_authorized" ON public.participants FOR SELECT TO authenticated USING (public.is_authorized_member());
DROP POLICY IF EXISTS "participants_insert_admin" ON public.participants;
CREATE POLICY "participants_insert_admin" ON public.participants FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "participants_update_admin" ON public.participants;
CREATE POLICY "participants_update_admin" ON public.participants FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "participants_delete_admin" ON public.participants;
CREATE POLICY "participants_delete_admin" ON public.participants FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "income_select_authorized" ON public.income_transactions;
CREATE POLICY "income_select_authorized" ON public.income_transactions FOR SELECT TO authenticated USING (public.is_authorized_member());
DROP POLICY IF EXISTS "income_insert_admin" ON public.income_transactions;
CREATE POLICY "income_insert_admin" ON public.income_transactions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "income_update_admin" ON public.income_transactions;
CREATE POLICY "income_update_admin" ON public.income_transactions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "income_delete_admin" ON public.income_transactions;
CREATE POLICY "income_delete_admin" ON public.income_transactions FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "expense_select_authorized" ON public.expense_transactions;
CREATE POLICY "expense_select_authorized" ON public.expense_transactions FOR SELECT TO authenticated USING (public.is_authorized_member());
DROP POLICY IF EXISTS "expense_insert_admin" ON public.expense_transactions;
CREATE POLICY "expense_insert_admin" ON public.expense_transactions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "expense_update_admin" ON public.expense_transactions;
CREATE POLICY "expense_update_admin" ON public.expense_transactions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "expense_delete_admin" ON public.expense_transactions;
CREATE POLICY "expense_delete_admin" ON public.expense_transactions FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "budget_settings_select_authorized" ON public.budget_settings;
CREATE POLICY "budget_settings_select_authorized" ON public.budget_settings FOR SELECT TO authenticated USING (public.is_authorized_member());
DROP POLICY IF EXISTS "budget_settings_insert_admin" ON public.budget_settings;
CREATE POLICY "budget_settings_insert_admin" ON public.budget_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "budget_settings_update_admin" ON public.budget_settings;
CREATE POLICY "budget_settings_update_admin" ON public.budget_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "budget_settings_delete_admin" ON public.budget_settings;
CREATE POLICY "budget_settings_delete_admin" ON public.budget_settings FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

-- ============================================================================
-- PART 3: PRIVATE STORAGE BUCKET & REALTIME PUBLICATION
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-receipts',
  'trip-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

DROP POLICY IF EXISTS "trip_receipts_read_authorized" ON storage.objects;
CREATE POLICY "trip_receipts_read_authorized" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trip-receipts' AND public.is_authorized_member());
DROP POLICY IF EXISTS "trip_receipts_insert_admin" ON storage.objects;
CREATE POLICY "trip_receipts_insert_admin" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trip-receipts' AND public.is_admin());
DROP POLICY IF EXISTS "trip_receipts_update_admin" ON storage.objects;
CREATE POLICY "trip_receipts_update_admin" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trip-receipts' AND public.is_admin()) WITH CHECK (bucket_id = 'trip-receipts' AND public.is_admin());
DROP POLICY IF EXISTS "trip_receipts_delete_admin" ON storage.objects;
CREATE POLICY "trip_receipts_delete_admin" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trip-receipts' AND public.is_admin());

ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.income_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.expense_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.budget_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'income_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.income_transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expense_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budget_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_settings;
  END IF;
END $$;

-- ============================================================================
-- PART 4: INITIAL STUDY TOUR SETTINGS & 36 UNNAMED PARTICIPANT SLOTS
-- ============================================================================
INSERT INTO public.budget_settings (trip_name, trip_start_date, trip_end_date, currency, budget_per_person, expected_advance)
SELECT 'Maharashtra Western Ghats Study Tour', '2026-12-03', '2026-12-12', 'INR', 12000.00, 5000.00
WHERE NOT EXISTS (SELECT 1 FROM public.budget_settings);

DO $$
DECLARE
  i integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.participants) THEN
    FOR i IN 1..33 LOOP
      INSERT INTO public.participants (participant_code, full_name, participant_type, total_budget, is_active)
      VALUES ('STU' || lpad(i::text, 3, '0'), 'Student ' || lpad(i::text, 2, '0'), 'student', 12000.00, true);
    END LOOP;
    FOR i IN 1..3 LOOP
      INSERT INTO public.participants (participant_code, full_name, participant_type, total_budget, is_active)
      VALUES ('FAC' || lpad(i::text, 3, '0'), 'Faculty ' || lpad(i::text, 2, '0'), 'faculty', 12000.00, true);
    END LOOP;
  END IF;
END $$;
