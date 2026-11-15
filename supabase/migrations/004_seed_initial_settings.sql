-- TripLedger Migration 004: Initial Tour Settings & Unassigned Roster Slots (33 Students + 3 Faculty)
-- Note: Zero participant names or financial transactions are invented.

-- 1. Seed initial budget settings if table is empty
INSERT INTO public.budget_settings (
  trip_name,
  trip_start_date,
  trip_end_date,
  currency,
  budget_per_person,
  expected_advance
)
SELECT
  'Maharashtra Western Ghats Study Tour',
  '2026-12-03',
  '2026-12-12',
  'INR',
  12000.00,
  5000.00
WHERE NOT EXISTS (SELECT 1 FROM public.budget_settings);

-- 2. Seed 33 unnamed student slots (STU001..STU033) and 3 unnamed faculty slots (FAC001..FAC003)
-- ONLY when the participants table is completely empty. Admin can rename or import real names.
DO $$
DECLARE
  i integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.participants) THEN
    FOR i IN 1..33 LOOP
      INSERT INTO public.participants (
        participant_code,
        full_name,
        participant_type,
        total_budget,
        is_active
      ) VALUES (
        'STU' || lpad(i::text, 3, '0'),
        'Student ' || lpad(i::text, 2, '0'),
        'student',
        12000.00,
        true
      );
    END LOOP;

    FOR i IN 1..3 LOOP
      INSERT INTO public.participants (
        participant_code,
        full_name,
        participant_type,
        total_budget,
        is_active
      ) VALUES (
        'FAC' || lpad(i::text, 3, '0'),
        'Faculty ' || lpad(i::text, 2, '0'),
        'faculty',
        12000.00,
        true
      );
    END LOOP;
  END IF;
END $$;
