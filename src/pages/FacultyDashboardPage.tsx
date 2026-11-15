import React, { useMemo, useState } from 'react';
import {
  Users,
  Target,
  IndianRupee,
  Receipt,
  Wallet,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useTripData } from '../context/TripDataContext';
import { formatDateShort, formatINR } from '../lib/formatters';
import { buildCategoryReport, buildDailyReport } from '../lib/exports';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import type { AppPageId } from '../components/AppShell';

interface FacultyDashboardPageProps {
  onNavigate: (page: AppPageId) => void;
}

export function FacultyDashboardPage({ onNavigate }: FacultyDashboardPageProps) {
  const {
    participantFinancials,
    incomeTransactions,
    expenseTransactions,
    budgetSettings,
    totals,
    loadingData,
  } = useTripData();

  const [previewReceipt, setPreviewReceipt] = useState<{ path: string; title: string } | null>(null);

  const dailyData = useMemo(
    () => buildDailyReport(incomeTransactions, expenseTransactions),
    [incomeTransactions, expenseTransactions]
  );

  const categoryData = useMemo(
    () => buildCategoryReport(expenseTransactions),
    [expenseTransactions]
  );

  const paymentSummaryCounts = useMemo(() => {
    const active = participantFinancials.filter((p) => p.is_active);
    return {
      paid: active.filter((p) => p.payment_status === 'Paid').length,
      partial: active.filter((p) => p.payment_status === 'Partial').length,
      unpaid: active.filter((p) => p.payment_status === 'Unpaid').length,
    };
  }, [participantFinancials]);

  const recentTransactions = useMemo(() => {
    const inc = incomeTransactions.map((t) => ({
      id: t.id,
      kind: 'income' as const,
      title: t.income_category,
      ref: t.transaction_reference,
      amount: Number(t.amount),
      date: t.transaction_date,
      createdAt: t.created_at,
      method: t.payment_method,
      receipt: t.receipt_file_path,
    }));
    const exp = expenseTransactions.map((t) => ({
      id: t.id,
      kind: 'expense' as const,
      title: t.expense_title,
      ref: t.transaction_reference,
      amount: Number(t.amount),
      date: t.transaction_date,
      createdAt: t.created_at,
      method: t.payment_method,
      receipt: t.receipt_file_path,
    }));
    return [...inc, ...exp]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
  }, [incomeTransactions, expenseTransactions]);

  if (loadingData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-[#E2E8E5] bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Total Participants',
      value: String(totals.totalActiveParticipants),
      subtext: `${totals.activeStudentsCount} Students · ${totals.activeFacultyCount} Faculty`,
      icon: Users,
      accent: 'text-[#113C2E] bg-[#E8F4EE]',
    },
    {
      label: 'Expected Collection',
      value: formatINR(totals.expectedCollection),
      subtext: 'Planned tour budget',
      icon: Target,
      accent: 'text-[#113C2E] bg-[#EEF3F0]',
    },
    {
      label: 'Amount Collected',
      value: formatINR(totals.totalCollected),
      subtext: `${totals.collectionProgressPct.toFixed(1)}% received`,
      icon: IndianRupee,
      accent: 'text-[#16794F] bg-[#E8F4EE]',
    },
    {
      label: 'Total Expenses',
      value: formatINR(totals.totalExpenses),
      subtext: `${expenseTransactions.length} bills logged`,
      icon: Receipt,
      accent: 'text-[#B91C1C] bg-[#FEE2E2]',
    },
    {
      label: 'Available Balance',
      value: formatINR(totals.availableBalance),
      subtext: 'Net funds on hand',
      icon: Wallet,
      accent:
        totals.availableBalance >= 0
          ? 'text-[#16794F] bg-[#E8F4EE]'
          : 'text-[#B91C1C] bg-[#FEE2E2]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Read-Only Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18] sm:text-2xl">
            {budgetSettings?.trip_name ?? 'Maharashtra Western Ghats Study Tour'}
          </h2>
          <p className="mt-1 text-xs text-[#4A5D55] sm:text-sm">
            {formatDateShort(budgetSettings?.trip_start_date ?? '2026-12-03')} –{' '}
            {formatDateShort(budgetSettings?.trip_end_date ?? '2026-12-12')}
            <span aria-hidden="true" className="mx-2 text-[#71857D]">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-[#113C2E]">
              <Lock className="h-3 w-3" />
              Read-Only Faculty Oversight
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-4 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          View Full Reports
        </button>
      </div>

      {/* 5 Core Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-[#E2E8E5] bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-[#4A5D55]">{card.label}</p>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 font-mono text-2xl font-semibold text-[#111C18] tabular-nums">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-[#71857D] tabular-nums">{card.subtext}</p>
            </div>
          );
        })}
      </section>

      {/* Budget Utilisation + Payment Summary */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#111C18]">Budget Utilisation</span>
            <span className="font-mono font-semibold text-[#111C18] tabular-nums">
              {totals.budgetUtilisationPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#EEF3F0]">
            <div
              className="h-full rounded-full bg-[#113C2E] transition-all duration-300"
              style={{ width: `${Math.min(100, totals.budgetUtilisationPct)}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#71857D] font-mono tabular-nums">
            <span>Expenses: {formatINR(totals.totalExpenses)}</span>
            <span>Pending Collection: {formatINR(totals.pendingCollection)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <h3 className="text-xs font-semibold text-[#111C18]">Payment Status Summary</h3>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[#E8F4EE] p-3">
              <p className="font-mono text-xl font-bold text-[#16794F] tabular-nums">
                {paymentSummaryCounts.paid}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#113C2E]">Fully Paid</p>
            </div>
            <div className="rounded-xl bg-[#FEF3C7] p-3">
              <p className="font-mono text-xl font-bold text-[#B45309] tabular-nums">
                {paymentSummaryCounts.partial}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#92400E]">Partial</p>
            </div>
            <div className="rounded-xl bg-[#EEF3F0] p-3">
              <p className="font-mono text-xl font-bold text-[#4A5D55] tabular-nums">
                {paymentSummaryCounts.unpaid}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#4A5D55]">Unpaid</p>
            </div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-[#111C18]">Income vs Expense</h3>
          <p className="mb-4 text-xs text-[#71857D]">Daily financial inflows and outflows</p>
          {dailyData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F7F9F8] text-xs text-[#71857D]">
              No financial transactions recorded yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => formatDateShort(v).replace(/,?\s*2026/, '')}
                    tick={{ fontSize: 11, fill: '#71857D' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#71857D' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(value: unknown) => formatINR(Number(value))}
                    labelFormatter={(label) => formatDateShort(String(label))}
                  />
                  <Bar dataKey="income" name="Income" fill="#16794F" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#B91C1C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-[#111C18]">Category-wise Expenses</h3>
          <p className="mb-4 text-xs text-[#71857D]">Verified spending breakdown by category</p>
          {categoryData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F7F9F8] text-xs text-[#71857D]">
              No expense categories recorded yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData.slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E5" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#71857D' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={135}
                    tick={{ fontSize: 11, fill: '#4A5D55' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value: unknown) => formatINR(Number(value))} />
                  <Bar dataKey="amount" name="Spent" fill="#113C2E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Recent Financial Transactions */}
      <section className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3.5">
          <div>
            <h3 className="text-sm font-semibold text-[#111C18]">Recent Financial Transactions</h3>
            <p className="text-xs text-[#71857D]">Live synchronised ledger feed</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="text-xs font-medium text-[#16794F] hover:text-[#113C2E]"
          >
            View Expenses
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="py-10 text-center text-xs text-[#71857D]">
            No financial transactions recorded yet. Updates appear automatically in real time.
          </p>
        ) : (
          <div className="divide-y divide-[#E2E8E5]">
            {recentTransactions.map((tx) => (
              <div key={`${tx.kind}-${tx.id}`} className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      tx.kind === 'income'
                        ? 'bg-[#E8F4EE] text-[#16794F]'
                        : 'bg-[#FEE2E2] text-[#B91C1C]'
                    }`}
                  >
                    {tx.kind === 'income' ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111C18]">{tx.title}</p>
                    <p className="truncate text-xs text-[#71857D]">
                      <span className="font-mono">{tx.ref}</span> · {formatDateShort(tx.date)} ·{' '}
                      {tx.method}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {tx.receipt && (
                    <button
                      type="button"
                      onClick={() => setPreviewReceipt({ path: tx.receipt!, title: tx.title })}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1 text-xs font-medium text-[#4A5D55] hover:bg-[#F7F9F8] hover:text-[#111C18]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Receipt</span>
                    </button>
                  )}
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      tx.kind === 'income' ? 'text-[#16794F]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {tx.kind === 'income' ? '+' : '-'}
                    {formatINR(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ReceiptPreviewModal
        filePath={previewReceipt?.path ?? null}
        title={previewReceipt?.title}
        onClose={() => setPreviewReceipt(null)}
      />
    </div>
  );
}
