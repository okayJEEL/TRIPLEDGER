import React, { useEffect, useState } from 'react';
import { Loader2, Save, KeyRound, UserCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTripData } from '../context/TripDataContext';
import { useToast } from '../context/ToastContext';
import { formatINR } from '../lib/formatters';
import { ConfirmModal } from '../components/ConfirmModal';

export function SettingsPage() {
  const { profile, updatePassword, updateProfileName } = useAuth();
  const { budgetSettings, updateBudgetSettings, applyBudgetToActiveParticipants } = useTripData();
  const { showToast } = useToast();

  // Trip Settings Form
  const [tripName, setTripName] = useState('Maharashtra Western Ghats Study Tour');
  const [startDate, setStartDate] = useState('2026-12-03');
  const [endDate, setEndDate] = useState('2026-12-12');
  const [currency, setCurrency] = useState('INR');
  const [budgetPerPerson, setBudgetPerPerson] = useState('12000');
  const [expectedAdvance, setExpectedAdvance] = useState('5000');
  const [savingSettings, setSavingSettings] = useState(false);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncingBudgets, setSyncingBudgets] = useState(false);

  // Account Profile & Password Form
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (budgetSettings) {
      setTripName(budgetSettings.trip_name);
      setStartDate(budgetSettings.trip_start_date);
      setEndDate(budgetSettings.trip_end_date);
      setCurrency(budgetSettings.currency);
      setBudgetPerPerson(String(budgetSettings.budget_per_person));
      setExpectedAdvance(String(budgetSettings.expected_advance));
    }
  }, [budgetSettings]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.full_name);
    }
  }, [profile]);

  const numericBudget = Number(budgetPerPerson) || 0;
  const numericAdvance = Number(expectedAdvance) || 0;
  const remainingExpected = Math.max(0, numericBudget - numericAdvance);

  const handleSaveTripSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSettings) return;

    if (endDate < startDate) {
      showToast('error', 'Invalid dates', 'Trip end date must be on or after start date.');
      return;
    }
    if (numericAdvance > numericBudget) {
      showToast('error', 'Invalid advance', 'Expected advance cannot exceed budget per person.');
      return;
    }

    setSavingSettings(true);
    const { error } = await updateBudgetSettings({
      trip_name: tripName.trim(),
      trip_start_date: startDate,
      trip_end_date: endDate,
      currency: currency.trim() || 'INR',
      budget_per_person: numericBudget,
      expected_advance: numericAdvance,
    });
    setSavingSettings(false);

    if (error) {
      showToast('error', 'Could not save settings', error);
    } else {
      showToast('success', 'Trip settings saved', 'Synchronised across all connected devices.');
    }
  };

  const handleSyncParticipantBudgets = async () => {
    if (syncingBudgets) return;
    setSyncingBudgets(true);
    const { error } = await applyBudgetToActiveParticipants(numericBudget);
    setSyncingBudgets(false);
    setSyncModalOpen(false);
    if (error) {
      showToast('error', 'Sync failed', error);
    } else {
      showToast(
        'success',
        'Participant budgets updated',
        `All active participants set to ${formatINR(numericBudget)}.`
      );
    }
  };

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingName || displayName.trim().length < 2) return;
    setSavingName(true);
    const { error } = await updateProfileName(displayName);
    setSavingName(false);
    if (error) {
      showToast('error', 'Update failed', error);
    } else {
      showToast('success', 'Profile updated', 'Display name saved.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;
    if (newPassword.length < 8) {
      showToast('error', 'Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Mismatch', 'Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    setSavingPassword(false);
    if (error) {
      showToast('error', 'Password update failed', error);
    } else {
      showToast('success', 'Password updated', 'Your new password is active.');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[#111C18]">
          Application Settings & Security
        </h2>
        <p className="mt-0.5 text-xs text-[#4A5D55]">
          Manage tour parameters, default per-person budgets, and account credentials
        </p>
      </div>

      {/* Tour & Budget Settings */}
      <section className="rounded-2xl border border-[#E2E8E5] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#111C18]">Tour & Budget Configuration</h3>
        <p className="mt-0.5 text-xs text-[#71857D]">
          Changes propagate instantly via Supabase Realtime to Faculty Viewers.
        </p>

        <form onSubmit={handleSaveTripSettings} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Trip Name *
              </label>
              <input
                type="text"
                required
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                End Date *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Budget Per Person (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={budgetPerPerson}
                onChange={(e) => setBudgetPerPerson(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Expected Advance (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={expectedAdvance}
                onChange={(e) => setExpectedAdvance(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F9F8] px-4 py-3 text-xs">
            <span className="text-[#4A5D55]">Remaining Expected Balance Per Person:</span>
            <span className="font-mono text-sm font-semibold text-[#113C2E] tabular-nums">
              {formatINR(remainingExpected)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Apply {formatINR(numericBudget)} to All Active Participants
            </button>

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] disabled:opacity-60"
            >
              {savingSettings ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Tour Settings
            </button>
          </div>
        </form>
      </section>

      {/* Account Profile & Password Security */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E2E8E5] bg-white p-6">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#16794F]" />
            <h3 className="text-sm font-semibold text-[#111C18]">Admin Profile</h3>
          </div>
          <form onSubmit={handleSaveProfileName} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Registered Email
              </label>
              <input
                type="email"
                disabled
                value={profile?.email ?? ''}
                className="w-full rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] px-3.5 py-2 text-sm text-[#71857D]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingName}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] disabled:opacity-60"
            >
              {savingName && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update Name
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#E2E8E5] bg-white p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#16794F]" />
            <h3 className="text-sm font-semibold text-[#111C18]">Change Password</h3>
          </div>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111C18] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16794F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#113C2E] disabled:opacity-60"
            >
              {savingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update Password
            </button>
          </form>
        </section>
      </div>

      <ConfirmModal
        open={syncModalOpen}
        title="Sync Budget to Active Participants"
        description={`This will update total_budget to ${formatINR(numericBudget)} for all currently active participants. Existing recorded payments remain unchanged.`}
        confirmLabel="Apply Budget"
        destructive={false}
        busy={syncingBudgets}
        onConfirm={handleSyncParticipantBudgets}
        onCancel={() => setSyncModalOpen(false)}
      />
    </div>
  );
}
