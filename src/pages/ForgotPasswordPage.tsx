import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Mail, AlertCircle } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid registered email address.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    const { error } = await sendPasswordReset(email);
    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9F8] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8E5] bg-white p-6 sm:p-8 shadow-sm">
        <BrandLogo variant="dark" size="md" />

        <h1 className="mt-6 font-display text-2xl font-bold text-[#111C18]">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm text-[#4A5D55] leading-relaxed">
          Enter your registered TripLedger login email and Supabase will send a secure password
          recovery link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-[#16794F]/30 bg-[#E8F4EE]/60 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16794F]" />
              <div>
                <p className="text-sm font-semibold text-[#111C18]">Recovery email sent</p>
                <p className="mt-1 text-xs text-[#4A5D55] leading-relaxed">
                  Check the inbox for <span className="font-medium text-[#111C18]">{email}</span>{' '}
                  and open the reset link to set a new password.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-[#B91C1C]/25 bg-[#FEE2E2]/45 p-3 text-xs text-[#991B1B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold text-[#111C18] mb-1.5"
              >
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2.5 pl-10 pr-4 text-sm text-[#111C18] focus:border-[#16794F] focus:outline-none focus:ring-2 focus:ring-[#16794F]/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#113C2E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174E3B] disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Link...
                </>
              ) : (
                'Send Recovery Link'
              )}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-[#4A5D55] hover:text-[#111C18]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
