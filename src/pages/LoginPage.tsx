import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Database,
  ArrowRight,
  Mountain,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { SetupGuideModal } from '../components/SetupGuideModal';
import { useAuth } from '../context/AuthContext';
import { getRememberedEmail, getRememberMePreference } from '../lib/supabase';

interface LoginPageProps {
  onForgotPassword: () => void;
}

const HERO_IMAGE_URL = '/src/assets/images/western_ghats_landscape_1794725940399.jpg';

export function LoginPage({ onForgotPassword }: LoginPageProps) {
  const { signIn, schemaMissing, authError, recheckSchema } = useAuth();
  const [email, setEmail] = useState<string>(() => getRememberedEmail());
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberMePreference());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    const { error } = await signIn(trimmedEmail, password, rememberMe);
    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
    }
  };

  const displayError = errorMsg || authError;

  return (
    <div className="min-h-screen bg-[#F7F9F8] lg:grid lg:grid-cols-12 lg:items-stretch">
      {/* Left Scenic Western Ghats Panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-[#113C2E] px-6 py-8 text-white sm:px-10 sm:py-10 lg:col-span-7 lg:min-h-screen lg:px-14 lg:py-12">
        {!imgError ? (
          <img
            src={HERO_IMAGE_URL}
            alt="Misty morning over the Maharashtra Western Ghats mountains"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#091D15] via-[#113C2E] to-[#16794F]" />
        )}

        {/* Measured Contrast Scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#091D15]/92 via-[#091D15]/50 to-[#091D15]/35"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <BrandLogo variant="light" size="lg" />
          <div className="hidden sm:flex items-center gap-2 text-xs text-white/85">
            <Mountain className="h-4 w-4 text-[#A7D7C0]" />
            <span>Sahyadri Study Tour</span>
          </div>
        </div>

        <div className="relative z-10 mt-10 lg:mt-0 max-w-xl">
          <p className="text-xs font-medium tracking-wide text-[#A7D7C0]">
            Maharashtra Western Ghats Study Tour
          </p>
          <h2 className="mt-2.5 font-display text-2xl font-bold leading-tight text-white sm:text-4xl [text-wrap:balance]">
            Transparent trip accounting across every participant and bill.
          </h2>
          <p className="mt-3 text-sm text-white/85 leading-relaxed sm:text-base max-w-lg">
            Real-time collection tracking, verified receipt storage, and instant faculty oversight
            backed by Supabase PostgreSQL.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/85 font-mono tabular-nums">
            <span>3 Dec – 12 Dec 2026</span>
            <span aria-hidden="true" className="text-white/45">·</span>
            <span>36 Initial Participants</span>
            <span aria-hidden="true" className="text-white/45">·</span>
            <span>₹12,000 / Person</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex flex-col justify-center bg-white px-5 py-10 sm:px-10 lg:col-span-5 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#111C18] sm:text-3xl">
              Welcome Back!
            </h1>
            <p className="mt-2 text-sm text-[#4A5D55]">
              Your trip finances, organised in one place.
            </p>
          </div>

          {schemaMissing && (
            <div className="mt-6 rounded-xl border border-[#B45309]/30 bg-[#FEF3C7]/45 p-4">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#B45309]" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#111C18]">
                    Supabase Schema Setup Required
                  </p>
                  <p className="mt-1 text-xs text-[#4A5D55] leading-relaxed">
                    Connected to <span className="font-mono">iapqnpznadwsohjqbegu.supabase.co</span>,
                    but the TripLedger tables are not provisioned yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSetupOpen(true)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#113C2E] underline underline-offset-2 hover:text-[#16794F]"
                  >
                    View SQL Setup Instructions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#B91C1C]/25 bg-[#FEE2E2]/45 p-3.5 text-xs text-[#991B1B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[#111C18] mb-1.5"
              >
                Login ID / Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2.5 pl-10 pr-4 text-sm text-[#111C18] placeholder:text-[#71857D]/70 focus:border-[#16794F] focus:outline-none focus:ring-2 focus:ring-[#16794F]/15 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-[#111C18]"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs font-medium text-[#16794F] hover:text-[#113C2E] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2.5 pl-10 pr-11 text-sm text-[#111C18] placeholder:text-[#71857D]/70 focus:border-[#16794F] focus:outline-none focus:ring-2 focus:ring-[#16794F]/15 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#71857D] hover:bg-[#EEF3F0] hover:text-[#111C18] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#4A5D55]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E2E8E5] text-[#16794F] focus:ring-[#16794F]/25"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#113C2E] px-5 py-3 text-sm font-semibold text-white hover:bg-[#174E3B] focus:outline-none focus:ring-2 focus:ring-[#16794F]/30 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-[#E2E8E5] pt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#71857D]">
            <span>Authorised Admin & Faculty Access Only</span>
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="font-medium text-[#4A5D55] hover:text-[#111C18] underline underline-offset-2"
            >
              Supabase Setup Guide
            </button>
          </div>
        </div>
      </div>

      <SetupGuideModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onRecheck={recheckSchema}
      />
    </div>
  );
}
