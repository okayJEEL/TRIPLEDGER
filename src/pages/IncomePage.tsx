import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  FileText,
  Upload,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTripData } from '../context/TripDataContext';
import { useToast } from '../context/ToastContext';
import {
  formatDateShort,
  formatINR,
  generateTransactionReference,
  validateReceiptFile,
} from '../lib/formatters';
import {
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type IncomeCategory,
  type IncomeTransaction,
  type PaymentMethod,
} from '../types/database';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';

export function IncomePage() {
  const { isAdmin } = useAuth();
  const {
    participants,
    incomeTransactions,
    addIncome,
    updateIncome,
    deleteIncome,
    uploadReceipt,
    totals,
  } = useTripData();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | IncomeCategory>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');

  // Form Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeTransaction | null>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>('Advance Payment');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete & Preview Modals
  const [deleteTarget, setDeleteTarget] = useState<IncomeTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<{ path: string; title: string } | null>(null);

  const participantById = useMemo(() => {
    const map = new Map<string, (typeof participants)[number]>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incomeTransactions.filter((tx) => {
      if (categoryFilter !== 'all' && tx.income_category !== categoryFilter) return false;
      if (methodFilter !== 'all' && tx.payment_method !== methodFilter) return false;
      if (!q) return true;
      const p = tx.participant_id ? participantById.get(tx.participant_id) : null;
      return (
        tx.transaction_reference.toLowerCase().includes(q) ||
        tx.income_category.toLowerCase().includes(q) ||
        (tx.notes ?? '').toLowerCase().includes(q) ||
        (p?.full_name.toLowerCase().includes(q) ?? false) ||
        (p?.participant_code.toLowerCase().includes(q) ?? false)
      );
    });
  }, [incomeTransactions, search, categoryFilter, methodFilter, participantById]);

  const openAddModal = () => {
    setEditing(null);
    setParticipantId('');
    setIncomeCategory('Advance Payment');
    setAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('UPI');
    setReference(generateTransactionReference('INC'));
    setNotes('');
    setReceiptFile(null);
    setExistingReceiptPath(null);
    setFormOpen(true);
  };

  const openEditModal = (tx: IncomeTransaction) => {
    setEditing(tx);
    setParticipantId(tx.participant_id ?? '');
    setIncomeCategory(tx.income_category);
    setAmount(String(tx.amount));
    setTransactionDate(tx.transaction_date);
    setPaymentMethod(tx.payment_method);
    setReference(tx.transaction_reference);
    setNotes(tx.notes ?? '');
    setReceiptFile(null);
    setExistingReceiptPath(tx.receipt_file_path);
    setFormOpen(true);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateReceiptFile(file);
    if (err) {
      showToast('error', 'Invalid file', err);
      e.target.value = '';
      return;
    }
    setReceiptFile(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast('error', 'Invalid amount', 'Amount must be greater than ₹0.');
      return;
    }
    if (!reference.trim()) {
      showToast('error', 'Missing reference', 'Transaction reference is required.');
      return;
    }

    setSaving(true);
    let finalReceiptPath = existingReceiptPath;

    if (receiptFile) {
      const { path, error: uploadErr } = await uploadReceipt(receiptFile, 'income');
      if (uploadErr) {
        setSaving(false);
        showToast('error', 'Receipt upload failed', uploadErr);
        return;
      }
      finalReceiptPath = path;
    }

    if (editing) {
      const { error } = await updateIncome(editing.id, {
        participant_id: participantId || null,
        income_category: incomeCategory,
        amount: numericAmount,
        transaction_date: transactionDate,
        payment_method: paymentMethod,
        transaction_reference: reference.trim(),
        notes: notes.trim() || null,
        receipt_file_path: finalReceiptPath,
      });
      setSaving(false);
      if (error) {
        showToast('error', 'Update failed', error);
      } else {
        showToast('success', 'Income updated', `${formatINR(numericAmount)} saved.`);
        setFormOpen(false);
      }
    } else {
      const { error } = await addIncome({
        participant_id: participantId || null,
        income_category: incomeCategory,
        amount: numericAmount,
        transaction_date: transactionDate,
        payment_method: paymentMethod,
        transaction_reference: reference.trim(),
        notes: notes.trim() || null,
        receipt_file_path: finalReceiptPath,
      });
      setSaving(false);
      if (error) {
        showToast('error', 'Could not record income', error);
      } else {
        showToast('success', 'Income recorded', `${formatINR(numericAmount)} added to ledger.`);
        setFormOpen(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error } = await deleteIncome(deleteTarget.id);
    setDeleting(false);
    if (error) {
      showToast('error', 'Delete failed', error);
    } else {
      showToast('success', 'Income deleted', `Reference ${deleteTarget.transaction_reference} removed.`);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18]">Income Ledger</h2>
          <p className="mt-0.5 text-xs text-[#4A5D55] tabular-nums">
            Total Collected: <span className="font-mono font-semibold text-[#16794F]">{formatINR(totals.totalCollected)}</span>
            {' · '}
            {incomeTransactions.length} verified transactions
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16794F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#113C2E] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Income
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#E2E8E5] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participant, reference, or notes..."
              className="w-full rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] py-2 pl-9 pr-3 text-sm focus:border-[#16794F] focus:bg-white focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | IncomeCategory)}
              className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-sm focus:border-[#16794F] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as 'all' | PaymentMethod)}
              className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-sm focus:border-[#16794F] focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8E5] bg-[#F7F9F8] text-xs font-semibold text-[#4A5D55]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Receipt / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E5]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#71857D]">
                    No income transactions recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const p = tx.participant_id ? participantById.get(tx.participant_id) : null;
                  return (
                    <tr key={tx.id} className="hover:bg-[#F7F9F8]/75">
                      <td className="px-4 py-3 text-xs text-[#4A5D55] whitespace-nowrap tabular-nums">
                        {formatDateShort(tx.transaction_date)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[#113C2E] whitespace-nowrap">
                        {tx.transaction_reference}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-[#111C18]">
                          {p ? p.full_name : 'General / Unlinked'}
                        </p>
                        {p && (
                          <p className="font-mono text-[11px] text-[#71857D]">{p.participant_code}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#111C18]">{tx.income_category}</td>
                      <td className="px-4 py-3 text-xs text-[#4A5D55]">{tx.payment_method}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#16794F] tabular-nums">
                        +{formatINR(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {tx.receipt_file_path && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewReceipt({
                                  path: tx.receipt_file_path!,
                                  title: `Income Receipt · ${tx.transaction_reference}`,
                                })
                              }
                              className="rounded-lg p-1.5 text-[#113C2E] hover:bg-[#E8F4EE]"
                              title="View receipt"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(tx)}
                                className="rounded-lg p-1.5 text-[#4A5D55] hover:bg-[#EEF3F0]"
                                title="Edit"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(tx)}
                                className="rounded-lg p-1.5 text-[#B91C1C] hover:bg-[#FEE2E2]"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8E5] bg-white p-8 text-center text-xs text-[#71857D]">
            No income transactions recorded yet.
          </div>
        ) : (
          filtered.map((tx) => {
            const p = tx.participant_id ? participantById.get(tx.participant_id) : null;
            return (
              <div key={tx.id} className="rounded-2xl border border-[#E2E8E5] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[#71857D]">{tx.transaction_reference}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-[#111C18]">
                      {p ? `${p.full_name} (${p.participant_code})` : 'General / Unlinked'}
                    </p>
                    <p className="mt-0.5 text-xs text-[#4A5D55]">
                      {tx.income_category} · {tx.payment_method} · {formatDateShort(tx.transaction_date)}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-[#16794F] tabular-nums shrink-0">
                    +{formatINR(Number(tx.amount))}
                  </span>
                </div>
                {(tx.receipt_file_path || isAdmin) && (
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#E2E8E5] pt-2.5">
                    {tx.receipt_file_path && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewReceipt({
                            path: tx.receipt_file_path!,
                            title: `Income Receipt · ${tx.transaction_reference}`,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#111C18]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Receipt
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(tx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#111C18]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#B91C1C]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Income Modal (Admin) */}
      {formOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E2E8E5] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3.5">
              <h3 className="text-base font-semibold text-[#111C18]">
                {editing ? 'Edit Income Transaction' : 'Record Income'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">
                  Participant (Optional for General Income)
                </label>
                <select
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                >
                  <option value="">General / Non-participant income</option>
                  {participants
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.participant_code} — {p.full_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Income Type *
                  </label>
                  <select
                    value={incomeCategory}
                    onChange={(e) => setIncomeCategory(e.target.value as IncomeCategory)}
                    className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  >
                    {INCOME_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">
                  Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional payment note or UTR details"
                  className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">
                  Payment Receipt (JPG, PNG, PDF — Max 10 MB)
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-[#CBD5D0] bg-[#F7F9F8] px-3.5 py-2.5 text-xs text-[#4A5D55] hover:border-[#16794F]">
                  <span className="truncate">
                    {receiptFile
                      ? receiptFile.name
                      : existingReceiptPath
                        ? `Current: ${existingReceiptPath.split('/').pop()}`
                        : 'Attach payment screenshot or PDF receipt'}
                  </span>
                  <Upload className="h-4 w-4 shrink-0 text-[#16794F]" />
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={handleFilePick}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-[#E2E8E5] px-4 py-2 text-xs font-semibold text-[#111C18]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#16794F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#113C2E] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editing ? 'Update Income' : 'Save Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Income Transaction"
        description={`Are you sure you want to delete ${deleteTarget?.transaction_reference} (${formatINR(Number(deleteTarget?.amount ?? 0))})? This action is recorded in Audit Logs and immediately updates participant balances.`}
        confirmLabel="Delete Income"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ReceiptPreviewModal
        filePath={previewReceipt?.path ?? null}
        title={previewReceipt?.title}
        onClose={() => setPreviewReceipt(null)}
      />
    </div>
  );
}
