import React, { useMemo } from 'react';
import {
  Users,
  Target,
  IndianRupee,
  Clock,
  Receipt,
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useTripData } from '../context/TripDataContext';
import { formatDateShort, formatINR } from '../lib/formatters';
import { buildCategoryReport, buildDailyReport } from '../lib/exports';
import type { AppPageId } from '../components/AppShell';

interface AdminDashboardPageProps {
  onNavigate: (page: AppPageId) => void;
}

const PIE_COLORS = {
  Paid: '#16794F',
  Partial: '#D97706',
  Unpaid: '#CBD5E1',
};

export function AdminDashboardPage({ onNavigate }: AdminDashboardPageProps) {
  const {
    participantFinancials,
    incomeTransactions,
    expenseTransactions,
    budgetSettings,
    totals,
    loadingData,
  } = useTripData();

  const dailyData = useMemo(
    () => buildDailyReport(incomeTransactions, expenseTransactions),
    [incomeTransactions, expenseTransactions]
  );

  const categoryData = useMemo(
    () => buildCategoryReport(expenseTransactions),
    [expenseTransactions]
  );

  const paymentStatusData = useMemo(() => {
    const active = participantFinancials.filter((p) => p.is_active);
    const paid = active.filter((p) => p.payment_status === 'Paid').length;
    const partial = active.filter((p) => p.payment_status === 'Partial').length;
    const unpaid = active.filter((p) => p.payment_status === 'Unpaid').length;
    return [
      { name: 'Paid', value: paid },
      { name: 'Partial', value: partial },
      { name: 'Unpaid', value: unpaid },
    ].filter((d) => d.value > 0);
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
    }));
    return [...inc, ...exp]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [incomeTransactions, expenseTransactions]);

  const recentParticipants = useMemo(
    () =>
      [...participantFinancials]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [participantFinancials]
  );

  const pendingParticipants = useMemo(
    () =>
      participantFinancials
        .filter((p) => p.is_active && p.remaining_balance > 0)
        .sort((a, b) => b.remaining_balance - a.remaining_balance)
        .slice(0, 6),
    [participantFinancials]
  );

  if (loadingData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-[#E2E8E5] bg-white p-5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl border border-[#E2E8E5] bg-white" />
          <div className="h-80 animate-pulse rounded-2xl border border-[#E2E8E5] bg-white" />
        </div>
      </div>
    );
  }

  const kpiCards = [
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
      subtext: `₹${Number(budgetSettings?.budget_per_person ?? 12000).toLocaleString('en-IN')} per person target`,
      icon: Target,
      accent: 'text-[#113C2E] bg-[#EEF3F0]',
    },
    {
      label: 'Total Collected',
      value: formatINR(totals.totalCollected),
      subtext: `${totals.collectionProgressPct.toFixed(1)}% of expected budget`,
      icon: IndianRupee,
      accent: 'text-[#16794F] bg-[#E8F4EE]',
    },
    {
      label: 'Pending Collection',
      value: formatINR(totals.pendingCollection),
      subtext: `${participantFinancials.filter((p) => p.is_active && p.remaining_balance > 0).length} participants with balance`,
      icon: Clock,
      accent: 'text-[#B45309] bg-[#FEF3C7]',
    },
    {
      label: 'Total Expenses',
      value: formatINR(totals.totalExpenses),
      subtext: `${expenseTransactions.length} recorded expense entries`,
      icon: Receipt,
      accent: 'text-[#B91C1C] bg-[#FEE2E2]',
    },
    {
      label: 'Available Balance',
      value: formatINR(totals.availableBalance),
      subtext: 'Collected minus actual expenses',
      icon: Wallet,
      accent:
        totals.availableBalance >= 0
          ? 'text-[#16794F] bg-[#E8F4EE]'
          : 'text-[#B91C1C] bg-[#FEE2E2]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Summary & Quick Admin Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18] sm:text-2xl">
            {budgetSettings?.trip_name ?? 'Maharashtra Western Ghats Study Tour'}
          </h2>
          <p className="mt-1 text-xs text-[#4A5D55] sm:text-sm">
            {formatDateShort(budgetSettings?.trip_start_date ?? '2026-12-03')} –{' '}
            {formatDateShort(budgetSettings?.trip_end_date ?? '2026-12-12')}
            <span aria-hidden="true" className="mx-2 text-[#71857D]">·</span>
            Expected Advance: {formatINR(Number(budgetSettings?.expected_advance ?? 5000))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('income')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16794F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#113C2E] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Income
          </button>
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* 6 Core KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Key Financial Metrics">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-[#E2E8E5] bg-white p-5 transition-colors hover:border-[#CBD5D0]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-[#4A5D55]">{card.label}</p>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.accent}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-[#111C18] tabular-nums sm:text-[26px]">
                {card.value}
              </p>
              <p className="mt-1.5 text-xs text-[#71857D] tabular-nums">{card.subtext}</p>
            </div>
          );
        })}
      </section>

      {/* Budget Utilisation & Collection Progress Strip */}
      <section className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111C18]">Budget Utilisation (Expenses vs Target)</span>
              <span className="font-mono font-semibold text-[#111C18] tabular-nums">
                {totals.budgetUtilisationPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF3F0]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  totals.budgetUtilisationPct > 90
                    ? 'bg-[#B91C1C]'
                    : totals.budgetUtilisationPct > 70
                      ? 'bg-[#D97706]'
                      : 'bg-[#113C2E]'
                }`}
                style={{ width: `${Math.min(100, totals.budgetUtilisationPct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#71857D] font-mono tabular-nums">
              {formatINR(totals.totalExpenses)} spent of {formatINR(totals.expectedCollection)} planned
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111C18]">Collection Progress (Received vs Target)</span>
              <span className="font-mono font-semibold text-[#16794F] tabular-nums">
                {totals.collectionProgressPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF3F0]">
              <div
                className="h-full rounded-full bg-[#16794F] transition-all duration-300"
                style={{ width: `${Math.min(100, totals.collectionProgressPct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#71857D] font-mono tabular-nums">
              {formatINR(totals.totalCollected)} collected · {formatINR(totals.pendingCollection)} remaining
            </p>
          </div>
        </div>
      </section>

      {/* Primary Charts Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income vs Expense Chart */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111C18]">Income vs Expenses</h3>
              <p className="text-xs text-[#71857D]">Daily inflows compared against trip spending</p>
            </div>
          </div>
          {dailyData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F7F9F8] text-center p-6">
              <div>
                <p className="text-sm font-medium text-[#111C18]">No cashflow activity recorded yet</p>
                <p className="mt-1 text-xs text-[#71857D]">
                  Income and expense entries will appear here automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8E5',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="income" name="Income" fill="#16794F" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#B91C1C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Daily Spending Trend */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#111C18]">Daily Spending Trend</h3>
            <p className="text-xs text-[#71857D]">Outflow trajectory across study tour dates</p>
          </div>
          {dailyData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F7F9F8] text-center p-6">
              <div>
                <p className="text-sm font-medium text-[#111C18]">No daily spending data yet</p>
                <p className="mt-1 text-xs text-[#71857D]">
                  Log an expense to track daily expenditure velocity.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#113C2E" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#113C2E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8E5',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Daily Spend"
                    stroke="#113C2E"
                    strokeWidth={2}
                    fill="url(#expenseFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment Status Pie Chart */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#111C18]">Participant Payment Status</h3>
            <p className="text-xs text-[#71857D]">
              Active participants grouped by verified payments
            </p>
          </div>
          {paymentStatusData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F7F9F8] text-xs text-[#71857D]">
              No active participants found.
            </div>
          ) : (
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {paymentStatusData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? '#16794F'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8E5',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {(['Paid', 'Partial', 'Unpaid'] as const).map((status) => {
                  const count =
                    participantFinancials.filter(
                      (p) => p.is_active && p.payment_status === status
                    ).length;
                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between border-b border-[#E2E8E5] pb-2 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[status] }}
                        />
                        <span className="text-xs font-medium text-[#111C18]">{status}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#111C18] tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Expense Category Breakdown */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#111C18]">Expense by Category</h3>
            <p className="text-xs text-[#71857D]">Allocation across study tour heads</p>
          </div>
          {categoryData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F7F9F8] text-center p-6">
              <div>
                <p className="text-sm font-medium text-[#111C18]">No expenses categorised yet</p>
                <p className="mt-1 text-xs text-[#71857D]">
                  Category breakdown updates automatically when bills are logged.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 10, bottom: 4 }}
                >
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
                  <Tooltip
                    formatter={(value: unknown) => formatINR(Number(value))}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8E5',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" name="Spent" fill="#16794F" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Operational Lists: Recent Transactions, Recent Participants, Pending Payments */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3">
            <h3 className="text-sm font-semibold text-[#111C18]">Recent Transactions</h3>
            <button
              type="button"
              onClick={() => onNavigate('income')}
              className="text-xs font-medium text-[#16794F] hover:text-[#113C2E]"
            >
              View All
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#71857D]">
              No income or expense transactions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8E5]">
              {recentTransactions.map((tx) => (
                <div key={`${tx.kind}-${tx.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
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
                      <p className="truncate text-xs font-semibold text-[#111C18]">{tx.title}</p>
                      <p className="truncate text-[11px] text-[#71857D]">
                        {formatDateShort(tx.date)} · {tx.method}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                      tx.kind === 'income' ? 'text-[#16794F]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {tx.kind === 'income' ? '+' : '-'}
                    {formatINR(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Participants */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3">
            <h3 className="text-sm font-semibold text-[#111C18]">Recent Participants</h3>
            <button
              type="button"
              onClick={() => onNavigate('participants')}
              className="text-xs font-medium text-[#16794F] hover:text-[#113C2E]"
            >
              Manage
            </button>
          </div>
          {recentParticipants.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#71857D]">No participants registered.</p>
          ) : (
            <div className="divide-y divide-[#E2E8E5]">
              {recentParticipants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#111C18]">{p.full_name}</p>
                    <p className="text-[11px] text-[#71857D]">
                      <span className="font-mono">{p.participant_code}</span> ·{' '}
                      {p.participant_type === 'faculty' ? 'Faculty' : 'Student'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs font-semibold text-[#111C18] tabular-nums">
                      {formatINR(p.amount_paid)}
                    </p>
                    <p className="text-[11px] text-[#71857D] tabular-nums">
                      of {formatINR(p.total_budget)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Payments */}
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#E2E8E5] pb-3">
            <h3 className="text-sm font-semibold text-[#111C18]">Pending Payments</h3>
            <button
              type="button"
              onClick={() => onNavigate('participants')}
              className="text-xs font-medium text-[#16794F] hover:text-[#113C2E]"
            >
              View Roster
            </button>
          </div>
          {pendingParticipants.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#16794F] font-medium">
              All active participants have cleared their budgets.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8E5]">
              {pendingParticipants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#111C18]">{p.full_name}</p>
                    <p className="text-[11px] text-[#71857D]">
                      <span className="font-mono">{p.participant_code}</span> · {p.payment_status}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#B45309] tabular-nums shrink-0">
                    {formatINR(p.remaining_balance)} due
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
