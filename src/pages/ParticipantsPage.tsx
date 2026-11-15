import React, { useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Upload,
  Edit3,
  Power,
  History,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTripData } from '../context/TripDataContext';
import { useToast } from '../context/ToastContext';
import {
  formatDateShort,
  formatINR,
  getNextParticipantCode,
} from '../lib/formatters';
import {
  downloadParticipantImportTemplate,
  parseParticipantImportFile,
  type ImportedParticipantRow,
} from '../lib/exports';
import type { ParticipantFinancialRow, ParticipantType, PaymentStatus } from '../types/database';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';

export function ParticipantsPage() {
  const { isAdmin } = useAuth();
  const {
    participants,
    participantFinancials,
    incomeTransactions,
    budgetSettings,
    addParticipant,
    updateParticipant,
    bulkImportParticipants,
  } = useTripData();
  const { showToast } = useToast();

  const defaultBudget = Number(budgetSettings?.budget_per_person ?? 12000);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ParticipantType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Add/Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ParticipantFinancialRow | null>(null);
  const [fullName, setFullName] = useState('');
  const [participantType, setParticipantType] = useState<ParticipantType>('student');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [totalBudget, setTotalBudget] = useState(String(defaultBudget));
  const [saving, setSaving] = useState(false);

  // Deactivate/Reactivate Confirm Modal
  const [toggleTarget, setToggleTarget] = useState<ParticipantFinancialRow | null>(null);
  const [toggling, setToggling] = useState(false);

  // Payment History Modal
  const [historyTarget, setHistoryTarget] = useState<ParticipantFinancialRow | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<{ path: string; title: string } | null>(null);

  // Import CSV/Excel Modal
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportedParticipantRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participantFinancials.filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (typeFilter !== 'all' && p.participant_type !== typeFilter) return false;
      if (statusFilter !== 'all' && p.payment_status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.participant_code.toLowerCase().includes(q) ||
        (p.phone_number ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [participantFinancials, search, typeFilter, statusFilter, showInactive]);

  const openAddModal = () => {
    setEditing(null);
    setFullName('');
    setParticipantType('student');
    setPhone('');
    setEmail('');
    setTotalBudget(String(defaultBudget));
    setFormOpen(true);
  };

  const openEditModal = (row: ParticipantFinancialRow) => {
    setEditing(row);
    setFullName(row.full_name);
    setParticipantType(row.participant_type);
    setPhone(row.phone_number ?? '');
    setEmail(row.email ?? '');
    setTotalBudget(String(row.total_budget));
    setFormOpen(true);
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const parsedBudget = Number(totalBudget);
    if (fullName.trim().length < 2) {
      showToast('error', 'Invalid name', 'Full name must be at least 2 characters.');
      return;
    }
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      showToast('error', 'Invalid budget', 'Total budget must be 0 or greater.');
      return;
    }

    setSaving(true);
    if (editing) {
      const { error } = await updateParticipant(editing.id, {
        full_name: fullName.trim(),
        participant_type: participantType,
        phone_number: phone.trim() || null,
        email: email.trim() || null,
        total_budget: parsedBudget,
      });
      setSaving(false);
      if (error) {
        showToast('error', 'Update failed', error);
      } else {
        showToast('success', 'Participant updated', `${fullName.trim()} saved.`);
        setFormOpen(false);
      }
    } else {
      const { error } = await addParticipant({
        full_name: fullName.trim(),
        participant_type: participantType,
        phone_number: phone.trim() || null,
        email: email.trim() || null,
        total_budget: parsedBudget,
        is_active: true,
      });
      setSaving(false);
      if (error) {
        showToast('error', 'Could not add participant', error);
      } else {
        showToast('success', 'Participant added', `${fullName.trim()} added to roster.`);
        setFormOpen(false);
      }
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!toggleTarget || toggling) return;
    setToggling(true);
    const nextActive = !toggleTarget.is_active;
    const { error } = await updateParticipant(toggleTarget.id, { is_active: nextActive });
    setToggling(false);
    if (error) {
      showToast('error', 'Action failed', error);
    } else {
      showToast(
        'success',
        nextActive ? 'Participant reactivated' : 'Participant deactivated',
        `${toggleTarget.full_name} (${toggleTarget.participant_code})`
      );
      setToggleTarget(null);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseParticipantImportFile(file, defaultBudget);
      setImportFileName(file.name);
      setImportRows(parsed);
    } catch {
      showToast('error', 'Import error', 'Could not read CSV/Excel file.');
    }
  };

  const handleConfirmImport = async () => {
    if (importing) return;
    setImporting(true);
    const { error, inserted } = await bulkImportParticipants(importRows);
    setImporting(false);
    if (error) {
      showToast('error', 'Import partially completed', error);
    } else {
      showToast('success', 'Participants imported', `${inserted} participants added.`);
      setImportOpen(false);
      setImportRows([]);
      setImportFileName('');
    }
  };

  const historyTransactions = useMemo(() => {
    if (!historyTarget) return [];
    return incomeTransactions.filter((t) => t.participant_id === historyTarget.id);
  }, [historyTarget, incomeTransactions]);

  const statusColorClass = (status: PaymentStatus) => {
    if (status === 'Paid') return 'text-[#16794F]';
    if (status === 'Partial') return 'text-[#B45309]';
    return 'text-[#71857D]';
  };

  return (
    <div className="space-y-5">
      {/* Header & Admin Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18]">Participant Roster</h2>
          <p className="mt-0.5 text-xs text-[#4A5D55] tabular-nums">
            {participants.filter((p) => p.is_active).length} active participants ·{' '}
            {participants.filter((p) => p.is_active && p.participant_type === 'student').length}{' '}
            students ·{' '}
            {participants.filter((p) => p.is_active && p.participant_type === 'faculty').length}{' '}
            faculty
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8] transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV / Excel
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Participant
            </button>
          </div>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-2xl border border-[#E2E8E5] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code (STU001), phone, or email..."
              className="w-full rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] py-2 pl-9 pr-3 text-sm text-[#111C18] focus:border-[#16794F] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type Segmented Filter */}
            <div className="flex items-center gap-1 rounded-xl bg-[#EEF3F0] p-1">
              {(['all', 'student', 'faculty'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-white text-[#111C18] shadow-xs'
                      : 'text-[#4A5D55] hover:text-[#111C18]'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'student' ? 'Students' : 'Faculty'}
                </button>
              ))}
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center gap-1 rounded-xl bg-[#EEF3F0] p-1">
              {(['all', 'Paid', 'Partial', 'Unpaid'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === s
                      ? 'bg-white text-[#111C18] shadow-xs'
                      : 'text-[#4A5D55] hover:text-[#111C18]'
                  }`}
                >
                  {s === 'all' ? 'Any Status' : s}
                </button>
              ))}
            </div>

            <label className="inline-flex cursor-pointer items-center gap-1.5 px-2 text-xs text-[#4A5D55]">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#E2E8E5] text-[#16794F]"
              />
              <span>Show inactive</span>
            </label>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8E5] bg-[#F7F9F8] text-xs font-semibold text-[#4A5D55]">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E5]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#71857D]">
                    No participants match your current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-[#F7F9F8]/75 ${
                      !p.is_active ? 'opacity-55' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#113C2E] whitespace-nowrap">
                      {p.participant_code}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#111C18]">{p.full_name}</p>
                      {(p.phone_number || p.email) && (
                        <p className="text-xs text-[#71857D]">
                          {[p.phone_number, p.email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4A5D55]">
                      {p.participant_type === 'faculty' ? 'Faculty' : 'Student'}
                      {!p.is_active && ' · Inactive'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium text-[#111C18] tabular-nums">
                      {formatINR(p.total_budget)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#16794F] tabular-nums">
                      {formatINR(p.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium text-[#111C18] tabular-nums">
                      {formatINR(p.remaining_balance)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={statusColorClass(p.payment_status)}>{p.payment_status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setHistoryTarget(p)}
                          className="rounded-lg p-1.5 text-[#4A5D55] hover:bg-[#EEF3F0] hover:text-[#111C18]"
                          title="Payment history"
                          aria-label={`View payment history for ${p.full_name}`}
                        >
                          <History className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="rounded-lg p-1.5 text-[#4A5D55] hover:bg-[#EEF3F0] hover:text-[#111C18]"
                              title="Edit participant"
                              aria-label={`Edit ${p.full_name}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setToggleTarget(p)}
                              className={`rounded-lg p-1.5 hover:bg-[#EEF3F0] ${
                                p.is_active
                                  ? 'text-[#B45309] hover:text-[#92400E]'
                                  : 'text-[#16794F]'
                              }`}
                              title={p.is_active ? 'Deactivate' : 'Reactivate'}
                              aria-label={
                                p.is_active
                                  ? `Deactivate ${p.full_name}`
                                  : `Reactivate ${p.full_name}`
                              }
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards (360px - 767px) */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8E5] bg-white p-8 text-center text-xs text-[#71857D]">
            No participants match your current filter.
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border border-[#E2E8E5] bg-white p-4 ${
                !p.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-[#113C2E]">
                    {p.participant_code} · {p.participant_type === 'faculty' ? 'Faculty' : 'Student'}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[#111C18]">
                    {p.full_name}
                  </p>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${statusColorClass(p.payment_status)}`}>
                  {p.payment_status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#E2E8E5] pt-3 text-xs">
                <div>
                  <p className="text-[11px] text-[#71857D]">Budget</p>
                  <p className="font-mono font-semibold text-[#111C18] tabular-nums">
                    {formatINR(p.total_budget)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#71857D]">Paid</p>
                  <p className="font-mono font-semibold text-[#16794F] tabular-nums">
                    {formatINR(p.amount_paid)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#71857D]">Due</p>
                  <p className="font-mono font-semibold text-[#111C18] tabular-nums">
                    {formatINR(p.remaining_balance)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#E2E8E5] pt-2.5">
                <button
                  type="button"
                  onClick={() => setHistoryTarget(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#111C18]"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#111C18]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setToggleTarget(p)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#B45309]"
                    >
                      <Power className="h-3.5 w-3.5" />
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Participant Modal (Admin) */}
      {formOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8E5] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3.5">
              <div>
                <h3 className="text-base font-semibold text-[#111C18]">
                  {editing ? `Edit ${editing.participant_code}` : 'Add New Participant'}
                </h3>
                {!editing && (
                  <p className="text-xs text-[#71857D]">
                    Assigned code preview:{' '}
                    <span className="font-mono font-semibold text-[#113C2E]">
                      {getNextParticipantCode(participants, participantType)}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParticipant} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter participant full name"
                  className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Category *
                  </label>
                  <select
                    value={participantType}
                    onChange={(e) => setParticipantType(e.target.value as ParticipantType)}
                    className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Total Budget (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-[#E2E8E5] px-4 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editing ? 'Save Changes' : 'Add Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV / Excel Import Modal (Admin) */}
      {importOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E2E8E5] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3.5">
              <div>
                <h3 className="text-base font-semibold text-[#111C18]">
                  Import Participants from CSV / Excel
                </h3>
                <p className="text-xs text-[#71857D]">
                  Codes (STUxxx / FACxxx) are generated automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] p-3.5">
                <span className="text-xs text-[#4A5D55]">
                  Need the expected column layout?
                </span>
                <button
                  type="button"
                  onClick={() => downloadParticipantImportTemplate(defaultBudget)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8E5] bg-white px-3 py-1.5 text-xs font-medium text-[#111C18] hover:bg-[#F7F9F8]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV Template
                </button>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5D0] bg-white p-6 text-center hover:border-[#16794F] transition-colors">
                <Upload className="h-6 w-6 text-[#16794F]" />
                <span className="mt-2 text-sm font-medium text-[#111C18]">
                  {importFileName || 'Choose .csv, .xlsx, or .xls file'}
                </span>
                <span className="mt-1 text-xs text-[#71857D]">
                  Columns: full_name, participant_type (student/faculty), phone_number, email, total_budget
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
              </label>

              {importRows.length > 0 && (
                <div className="rounded-xl border border-[#E2E8E5] overflow-hidden">
                  <div className="bg-[#F7F9F8] px-3.5 py-2 text-xs font-semibold text-[#111C18] flex items-center justify-between">
                    <span>Preview ({importRows.length} rows)</span>
                    <span className="text-[#16794F]">
                      {importRows.filter((r) => !r.error).length} valid
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-[#E2E8E5]">
                    {importRows.map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#111C18]">
                            {row.full_name || '(Missing name)'}
                          </p>
                          <p className="text-[#71857D]">
                            {row.participant_type} · {formatINR(row.total_budget)}
                          </p>
                        </div>
                        {row.error ? (
                          <span className="inline-flex items-center gap-1 text-[#B91C1C] shrink-0">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {row.error}
                          </span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-[#16794F] shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="rounded-xl border border-[#E2E8E5] px-4 py-2 text-xs font-semibold text-[#111C18]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importing || importRows.filter((r) => !r.error).length === 0}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] disabled:opacity-50"
                >
                  {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Import Valid Participants
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participant Payment History Modal */}
      {historyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E2E8E5] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8E5] pb-3.5">
              <div>
                <p className="font-mono text-xs font-semibold text-[#16794F]">
                  {historyTarget.participant_code}
                </p>
                <h3 className="text-base font-semibold text-[#111C18]">
                  {historyTarget.full_name} — Payment History
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-[#F7F9F8] p-3 text-center">
              <div>
                <p className="text-[11px] text-[#71857D]">Budget</p>
                <p className="font-mono text-sm font-semibold text-[#111C18] tabular-nums">
                  {formatINR(historyTarget.total_budget)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#71857D]">Paid</p>
                <p className="font-mono text-sm font-semibold text-[#16794F] tabular-nums">
                  {formatINR(historyTarget.amount_paid)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#71857D]">Remaining</p>
                <p className="font-mono text-sm font-semibold text-[#B45309] tabular-nums">
                  {formatINR(historyTarget.remaining_balance)}
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[#E2E8E5]">
              {historyTransactions.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#71857D]">
                  No income transactions recorded for this participant yet.
                </p>
              ) : (
                historyTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#111C18]">{tx.income_category}</p>
                      <p className="text-[11px] text-[#71857D]">
                        <span className="font-mono">{tx.transaction_reference}</span> ·{' '}
                        {formatDateShort(tx.transaction_date)} · {tx.payment_method}
                      </p>
                      {tx.notes && <p className="mt-0.5 text-[11px] text-[#4A5D55]">{tx.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tx.receipt_file_path && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewReceipt({
                              path: tx.receipt_file_path!,
                              title: `${historyTarget.full_name} · ${tx.transaction_reference}`,
                            })
                          }
                          className="rounded-lg border border-[#E2E8E5] p-1.5 text-[#4A5D55] hover:bg-[#F7F9F8]"
                          title="View receipt"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="font-mono text-xs font-semibold text-[#16794F] tabular-nums">
                        +{formatINR(Number(tx.amount))}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(toggleTarget)}
        title={toggleTarget?.is_active ? 'Deactivate Participant' : 'Reactivate Participant'}
        description={
          toggleTarget?.is_active
            ? `Deactivating ${toggleTarget.full_name} (${toggleTarget.participant_code}) removes their budget from active Expected Collection totals while preserving past payment records.`
            : `Reactivating ${toggleTarget?.full_name} (${toggleTarget?.participant_code}) includes their budget in Expected Collection totals again.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Reactivate'}
        destructive={Boolean(toggleTarget?.is_active)}
        busy={toggling}
        onConfirm={handleConfirmToggleActive}
        onCancel={() => setToggleTarget(null)}
      />

      <ReceiptPreviewModal
        filePath={previewReceipt?.path ?? null}
        title={previewReceipt?.title}
        onClose={() => setPreviewReceipt(null)}
      />
    </div>
  );
}
