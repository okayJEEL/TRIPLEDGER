import React, { useState } from 'react';
import { Check, Copy, Database, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface SetupGuideModalProps {
  open: boolean;
  onClose: () => void;
  onRecheck?: () => Promise<boolean>;
}

const MIGRATION_INSTRUCTIONS = `1. Open your Supabase Dashboard -> SQL Editor:
   https://supabase.com/dashboard/project/iapqnpznadwsohjqbegu/sql/new

2. Run the 4 migration files in order from /supabase/migrations/:
   - 001_initial_schema.sql
   - 002_rls_and_grants.sql
   - 003_storage_and_realtime.sql
   - 004_seed_initial_settings.sql

3. Create your two login accounts in Authentication -> Users -> Add user:
   - User 1 (Admin): Jeel Parmar's email + strong password (check "Auto Confirm User")
   - User 2 (Faculty Viewer): Faculty email + strong password (check "Auto Confirm User")

4. Link their roles in SQL Editor using 005_link_accounts_template.sql:`;

const LINK_SQL_SNIPPET = `INSERT INTO public.profiles (id, full_name, email, role)
SELECT id, 'Jeel Parmar', email, 'admin'
FROM auth.users WHERE lower(email) = lower('jeel.parmar.1104@gmail.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Jeel Parmar';

INSERT INTO public.profiles (id, full_name, email, role)
SELECT id, 'Faculty Viewer', email, 'faculty_viewer'
FROM auth.users WHERE lower(email) = lower('FACULTY_EMAIL_HERE')
ON CONFLICT (id) DO UPDATE SET role = 'faculty_viewer', full_name = 'Faculty Viewer';`;

export function SetupGuideModal({ open, onClose, onRecheck }: SetupGuideModalProps) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(LINK_SQL_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleVerify = async () => {
    if (!onRecheck) return;
    setChecking(true);
    const ok = await onRecheck();
    setChecking(false);
    setStatusMessage(
      ok
        ? 'Database schema detected! You can now sign in with your provisioned account.'
        : 'Tables are not yet visible in the schema cache. Please ensure migrations 001–004 ran cleanly.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Supabase Database Setup Guide"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E2E8E5] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8E5] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F4EE] text-[#113C2E]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#111C18]">
                Supabase Database Provisioning
              </h3>
              <p className="text-xs text-[#4A5D55]">
                Project: <span className="font-mono">iapqnpznadwsohjqbegu.supabase.co</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0] hover:text-[#111C18]"
            aria-label="Close setup guide"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-[#4A5D55] leading-relaxed">
            TripLedger connects directly to your existing Supabase project using the publishable key.
            Because schema creation and user provisioning require administrator privileges in
            Supabase, run the included SQL migration scripts in your Supabase SQL Editor once.
          </p>

          <pre className="whitespace-pre-wrap rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] p-4 font-mono text-xs text-[#111C18] leading-relaxed">
            {MIGRATION_INSTRUCTIONS}
          </pre>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111C18]">
                Role Linking SQL Snippet
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8E5] bg-white px-2.5 py-1 text-xs font-medium text-[#111C18] hover:bg-[#F7F9F8]"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#16794F]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy SQL'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-[#E2E8E5] bg-[#091D15] p-3.5 font-mono text-xs text-[#E8F4EE]">
              {LINK_SQL_SNIPPET}
            </pre>
          </div>

          {statusMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] px-3.5 py-2.5 text-xs text-[#111C18]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#16794F]" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            {onRecheck && (
              <button
                type="button"
                onClick={handleVerify}
                disabled={checking}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8E5] bg-white px-4 py-2 text-sm font-medium text-[#111C18] hover:bg-[#F7F9F8] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking...' : 'Verify Database Connection'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#113C2E] px-4 py-2 text-sm font-medium text-white hover:bg-[#174E3B]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
