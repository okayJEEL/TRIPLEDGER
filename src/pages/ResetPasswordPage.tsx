import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';

export function ResetPasswordPage() {
  const { updatePassword, clearRecoveryMode } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9F8] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8E5] bg-white p-6 sm:p-8 shadow-sm">
        <BrandLogo variant="dark" size="md" />

        <h1 className="mt-6 font-display text-2xl font-bold text-[#111C18]">
          Set New Password
        </h1>
        <p className="mt-1.5 text-sm text-[#4A5D55]">
          Choose a strong password for your TripLedger account.
        </p>

        {success ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-[#16794F]/30 bg-[#E8F4EE]/60 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16794F]" />
              <div>
                <p className="text-sm font-semibold text-[#111C18]">Password updated</p>
                <p className="mt-1 text-xs text-[#4A5D55]">
                  Your new password is active. You can continue into TripLedger.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearRecoveryMode}
              className="w-full rounded-xl bg-[#113C2E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174E3B]"
            >
              Continue to Dashboard
            </button>
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
                htmlFor="new-password"
                className="block text-xs font-semibold text-[#111C18] mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2.5 pl-10 pr-10 text-sm text-[#111C18] focus:border-[#16794F] focus:outline-none focus:ring-2 focus:ring-[#16794F]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#71857D] hover:text-[#111C18]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-[#111C18] mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2.5 pl-10 pr-4 text-sm text-[#111C18] focus:border-[#16794F] focus:outline-none focus:ring-2 focus:ring-[#16794F]/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#113C2E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174E3B] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
