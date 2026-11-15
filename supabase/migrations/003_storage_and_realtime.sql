-- TripLedger Migration 003: Private Storage Bucket, Storage RLS, and Realtime Publication

-- 1. Create Private Storage Bucket for Receipts & Bills
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-receipts',
  'trip-receipts',
  false,
  10485760, -- 10 MB max per file
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 2. Storage RLS Policies on storage.objects
DROP POLICY IF EXISTS "trip_receipts_read_authorized" ON storage.objects;
CREATE POLICY "trip_receipts_read_authorized"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trip-receipts' AND public.is_authorized_member());

DROP POLICY IF EXISTS "trip_receipts_insert_admin" ON storage.objects;
CREATE POLICY "trip_receipts_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trip-receipts' AND public.is_admin());

DROP POLICY IF EXISTS "trip_receipts_update_admin" ON storage.objects;
CREATE POLICY "trip_receipts_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trip-receipts' AND public.is_admin())
  WITH CHECK (bucket_id = 'trip-receipts' AND public.is_admin());

DROP POLICY IF EXISTS "trip_receipts_delete_admin" ON storage.objects;
CREATE POLICY "trip_receipts_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trip-receipts' AND public.is_admin());

-- 3. Enable Full Replica Identity & Realtime Publication for Live Multi-Device Sync
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.income_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.expense_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.budget_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'income_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.income_transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expense_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budget_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_settings;
  END IF;
END $$;
