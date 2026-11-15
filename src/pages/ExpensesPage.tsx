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
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type ExpenseCategory,
  type ExpenseTransaction,
  type PaymentMethod,
} from '../types/database';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';

export function ExpensesPage() {
  const { isAdmin } = useAuth();
  const {
    expenseTransactions,
    addExpense,
    updateExpense,
    deleteExpense,
    uploadReceipt,
    totals,
  } = useTripData();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseTransaction | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Accommodation');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete & Preview Modals
  const [deleteTarget, setDeleteTarget] = useState<ExpenseTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<{ path: string; title: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenseTransactions.filter((tx) => {
      if (categoryFilter !== 'all' && tx.expense_category !== categoryFilter) return false;
      if (dateFrom && tx.transaction_date < dateFrom) return false;
      if (dateTo && tx.transaction_date > dateTo) return false;
      if (!q) return true;
      return (
        tx.expense_title.toLowerCase().includes(q) ||
        tx.vendor_or_payee.toLowerCase().includes(q) ||
        tx.transaction_reference.toLowerCase().includes(q) ||
        tx.expense_category.toLowerCase().includes(q) ||
        (tx.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [expenseTransactions, search, categoryFilter, dateFrom, dateTo]);

  const openAddModal = () => {
    setEditing(null);
    setExpenseTitle('');
    setExpenseCategory('Accommodation');
    setAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setVendor('');
    setPaymentMethod('UPI');
    setReference(generateTransactionReference('EXP'));
    setDescription('');
    setReceiptFile(null);
    setExistingReceiptPath(null);
    setFormOpen(true);
  };

  const openEditModal = (tx: ExpenseTransaction) => {
    setEditing(tx);
    setExpenseTitle(tx.expense_title);
    setExpenseCategory(tx.expense_category);
    setAmount(String(tx.amount));
    setTransactionDate(tx.transaction_date);
    setVendor(tx.vendor_or_payee);
    setPaymentMethod(tx.payment_method);
    setReference(tx.transaction_reference);
    setDescription(tx.description ?? '');
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
    if (expenseTitle.trim().length < 2) {
      showToast('error', 'Invalid title', 'Expense title must be at least 2 characters.');
      return;
    }
    if (!vendor.trim()) {
      showToast('error', 'Missing vendor', 'Vendor or payee name is required.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast('error', 'Invalid amount', 'Amount must be greater than ₹0.');
      return;
    }

    setSaving(true);
    let finalReceiptPath = existingReceiptPath;

    if (receiptFile) {
      const { path, error: uploadErr } = await uploadReceipt(receiptFile, 'expenses');
      if (uploadErr) {
        setSaving(false);
        showToast('error', 'Bill upload failed', uploadErr);
        return;
      }
      finalReceiptPath = path;
    }

    if (editing) {
      const { error } = await updateExpense(editing.id, {
        expense_title: expenseTitle.trim(),
        expense_category: expenseCategory,
        amount: numericAmount,
        transaction_date: transactionDate,
        vendor_or_payee: vendor.trim(),
        payment_method: paymentMethod,
        transaction_reference: reference.trim(),
        description: description.trim() || null,
        receipt_file_path: finalReceiptPath,
      });
      setSaving(false);
      if (error) {
        showToast('error', 'Update failed', error);
      } else {
        showToast('success', 'Expense updated', `${expenseTitle.trim()} updated.`);
        setFormOpen(false);
      }
    } else {
      const { error } = await addExpense({
        expense_title: expenseTitle.trim(),
        expense_category: expenseCategory,
        amount: numericAmount,
        transaction_date: transactionDate,
        vendor_or_payee: vendor.trim(),
        payment_method: paymentMethod,
        transaction_reference: reference.trim(),
        description: description.trim() || null,
        receipt_file_path: finalReceiptPath,
      });
      setSaving(false);
      if (error) {
        showToast('error', 'Could not add expense', error);
      } else {
        showToast('success', 'Expense recorded', `${formatINR(numericAmount)} logged.`);
        setFormOpen(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error } = await deleteExpense(deleteTarget.id);
    setDeleting(false);
    if (error) {
      showToast('error', 'Delete failed', error);
    } else {
      showToast('success', 'Expense deleted', `${deleteTarget.expense_title} removed.`);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18]">Expense Ledger</h2>
          <p className="mt-0.5 text-xs text-[#4A5D55] tabular-nums">
            Total Spent: <span className="font-mono font-semibold text-[#B91C1C]">{formatINR(totals.totalExpenses)}</span>
            {' · '}
            {expenseTransactions.length} recorded bills
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#E2E8E5] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expense title, vendor, or reference..."
              className="w-full rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] py-2 pl-9 pr-3 text-sm focus:border-[#16794F] focus:bg-white focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | ExpenseCategory)}
              className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-sm focus:border-[#16794F] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Filter from date"
              className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs focus:border-[#16794F] focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Filter to date"
              className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs focus:border-[#16794F] focus:outline-none"
            />
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
                <th className="px-4 py-3">Expense & Vendor</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Bill / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E5]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#71857D]">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F7F9F8]/75">
                    <td className="px-4 py-3 text-xs text-[#4A5D55] whitespace-nowrap tabular-nums">
                      <p>{formatDateShort(tx.transaction_date)}</p>
                      <p className="font-mono text-[11px] text-[#71857D]">{tx.transaction_reference}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-[#111C18]">{tx.expense_title}</p>
                      <p className="text-[11px] text-[#71857D]">
                        Payee: {tx.vendor_or_payee}
                        {tx.description ? ` · ${tx.description}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4A5D55]">{tx.expense_category}</td>
                    <td className="px-4 py-3 text-xs text-[#4A5D55]">{tx.payment_method}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#B91C1C] tabular-nums">
                      -{formatINR(Number(tx.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {tx.receipt_file_path && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewReceipt({
                                path: tx.receipt_file_path!,
                                title: `${tx.expense_title} · ${tx.vendor_or_payee}`,
                              })
                            }
                            className="rounded-lg p-1.5 text-[#113C2E] hover:bg-[#E8F4EE]"
                            title="Preview / Download bill"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8E5] bg-white p-8 text-center text-xs text-[#71857D]">
            No expenses recorded yet.
          </div>
        ) : (
          filtered.map((tx) => (
            <div key={tx.id} className="rounded-2xl border border-[#E2E8E5] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-[#71857D]">
                    {tx.transaction_reference} · {formatDateShort(tx.transaction_date)}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[#111C18]">
                    {tx.expense_title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#4A5D55]">
                    {tx.expense_category} · {tx.vendor_or_payee}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-[#B91C1C] tabular-nums shrink-0">
                  -{formatINR(Number(tx.amount))}
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
                          title: `${tx.expense_title} · ${tx.vendor_or_payee}`,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1.5 text-xs font-medium text-[#111C18]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Bill
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
          ))
        )}
      </div>

      {/* Add / Edit Expense Modal (Admin) */}
      {formOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E2E8E5] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3.5">
              <h3 className="text-base font-semibold text-[#111C18]">
                {editing ? 'Edit Expense' : 'Record New Expense'}
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
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="e.g., Bus Rental Advance or Mahabaleshwar Stay"
                  className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Category *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
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
                    placeholder="2000"
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">Date *</label>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Vendor / Payee *
                  </label>
                  <input
                    type="text"
                    required
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="Hotel / Operator / Shop name"
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111C18] mb-1">
                    Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 font-mono text-sm focus:border-[#16794F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional breakdown or invoice details"
                  className="w-full rounded-xl border border-[#E2E8E5] px-3.5 py-2 text-sm focus:border-[#16794F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C18] mb-1">
                  Bill / Receipt Upload (JPG, PNG, PDF — Max 10 MB)
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-[#CBD5D0] bg-[#F7F9F8] px-3.5 py-2.5 text-xs text-[#4A5D55] hover:border-[#16794F]">
                  <span className="truncate">
                    {receiptFile
                      ? receiptFile.name
                      : existingReceiptPath
                        ? `Current: ${existingReceiptPath.split('/').pop()}`
                        : 'Upload bill image or PDF document'}
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editing ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Expense Record"
        description={`Are you sure you want to delete "${deleteTarget?.expense_title}" (${formatINR(Number(deleteTarget?.amount ?? 0))})? This deletion is logged in Audit Logs and immediately updates Available Balance.`}
        confirmLabel="Delete Expense"
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
