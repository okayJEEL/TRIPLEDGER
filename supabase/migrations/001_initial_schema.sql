-- TripLedger Migration 001: Core Relational Schema, Constraints, Indexes, and Audit Triggers
-- Target: Existing Supabase PostgreSQL Project

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User Profiles (maps Supabase Auth users to strict application roles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email text NOT NULL UNIQUE CHECK (position('@' in email) > 1),
  role text NOT NULL CHECK (role IN ('admin', 'faculty_viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Participants (Students & Faculty attending the study tour)
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

-- 3. Income Transactions (Single source of truth for money actually collected)
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

-- 4. Expense Transactions
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

-- 5. Budget & Trip Settings
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

-- 6. Immutable Audit Logs
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_participants_type_active ON public.participants(participant_type, is_active);
CREATE INDEX IF NOT EXISTS idx_participants_code ON public.participants(participant_code);
CREATE INDEX IF NOT EXISTS idx_income_participant_id ON public.income_transactions(participant_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON public.income_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_category ON public.expense_transactions(expense_category);
CREATE INDEX IF NOT EXISTS idx_expense_date ON public.expense_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Automatic updated_at Trigger Function
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
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_participants_updated_at ON public.participants;
CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_income_updated_at ON public.income_transactions;
CREATE TRIGGER trg_income_updated_at
  BEFORE UPDATE ON public.income_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_expense_updated_at ON public.expense_transactions;
CREATE TRIGGER trg_expense_updated_at
  BEFORE UPDATE ON public.expense_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_budget_settings_updated_at ON public.budget_settings;
CREATE TRIGGER trg_budget_settings_updated_at
  BEFORE UPDATE ON public.budget_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatic Participant Code Generator (STU001 / FAC001)
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
      MAX(
        NULLIF(regexp_replace(participant_code, '^' || prefix, ''), '')::integer
      ),
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

-- Immutable Audit Log Trigger Function
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
CREATE TRIGGER trg_audit_participants
  AFTER INSERT OR UPDATE OR DELETE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_income ON public.income_transactions;
CREATE TRIGGER trg_audit_income
  AFTER INSERT OR UPDATE OR DELETE ON public.income_transactions
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_expense ON public.expense_transactions;
CREATE TRIGGER trg_audit_expense
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_transactions
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_budget_settings ON public.budget_settings;
CREATE TRIGGER trg_audit_budget_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_settings
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();
