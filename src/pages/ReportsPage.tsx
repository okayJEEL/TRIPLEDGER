import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import { useTripData } from '../context/TripDataContext';
import { formatDateShort, formatINR } from '../lib/formatters';
import {
  buildCategoryReport,
  buildDailyReport,
  exportActiveTabToCSV,
  exportReportsToExcel,
  exportReportsToPDF,
} from '../lib/exports';

type ReportTab = 'overall' | 'participants' | 'categories' | 'daily';

export function ReportsPage() {
  const {
    participantFinancials,
    incomeTransactions,
    expenseTransactions,
    budgetSettings,
    totals,
  } = useTripData();

  const [activeTab, setActiveTab] = useState<ReportTab>('overall');

  const categoryRows = useMemo(
    () => buildCategoryReport(expenseTransactions),
    [expenseTransactions]
  );

  const dailyRows = useMemo(
    () => buildDailyReport(incomeTransactions, expenseTransactions),
    [incomeTransactions, expenseTransactions]
  );

  const handleExportExcel = () => {
    exportReportsToExcel({
      settings: budgetSettings,
      totals,
      participantRows: participantFinancials,
      categoryRows,
      dailyRows,
    });
  };

  const handleExportCSV = () => {
    exportActiveTabToCSV(activeTab, {
      totals,
      participantRows: participantFinancials,
      categoryRows,
      dailyRows,
    });
  };

  const handleExportPDF = () => {
    exportReportsToPDF({
      settings: budgetSettings,
      totals,
      participantRows: participantFinancials,
      categoryRows,
      dailyRows,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Exports */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18]">Financial Reports</h2>
          <p className="mt-0.5 text-xs text-[#4A5D55]">
            {budgetSettings?.trip_name ?? 'Maharashtra Western Ghats Study Tour'} · Live audited calculations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8] whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#16794F]" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] whitespace-nowrap shrink-0"
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Segmented Report Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#E2E8E5] bg-[#EEF3F0] p-1.5 w-fit max-w-full">
        {(
          [
            { id: 'overall', label: 'Overall Summary' },
            { id: 'participants', label: 'Participant Report' },
            { id: 'categories', label: 'Category Report' },
            { id: 'daily', label: 'Daily Report' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-[#111C18] shadow-xs'
                : 'text-[#4A5D55] hover:text-[#111C18]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overall Summary */}
      {activeTab === 'overall' && (
        <div className="rounded-2xl border border-[#E2E8E5] bg-white p-6">
          <h3 className="text-sm font-semibold text-[#111C18]">Overall Financial Statement</h3>
          <p className="mt-0.5 text-xs text-[#71857D]">
            Derived directly from active participant budgets, recorded income, and recorded expenses.
          </p>

          <div className="mt-5 divide-y divide-[#E2E8E5]">
            {[
              {
                label: 'Active Participants',
                value: `${totals.totalActiveParticipants} (${totals.activeStudentsCount} Students · ${totals.activeFacultyCount} Faculty)`,
                tone: 'text-[#111C18]',
              },
              {
                label: 'Expected Budget (Total Payable)',
                value: formatINR(totals.expectedCollection),
                tone: 'text-[#111C18]',
              },
              {
                label: 'Actual Collection (Verified Income)',
                value: formatINR(totals.totalCollected),
                tone: 'text-[#16794F]',
              },
              {
                label: 'Pending Payments',
                value: formatINR(totals.pendingCollection),
                tone: 'text-[#B45309]',
              },
              {
                label: 'Total Expenses',
                value: formatINR(totals.totalExpenses),
                tone: 'text-[#B91C1C]',
              },
              {
                label: 'Available Balance',
                value: formatINR(totals.availableBalance),
                tone: totals.availableBalance >= 0 ? 'text-[#16794F]' : 'text-[#B91C1C]',
              },
              {
                label: 'Budget Utilisation',
                value: `${totals.budgetUtilisationPct.toFixed(2)}%`,
                tone: 'text-[#111C18]',
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-sm text-[#4A5D55]">{row.label}</span>
                <span className={`font-mono text-sm font-semibold tabular-nums ${row.tone}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Participant Report */}
      {activeTab === 'participants' && (
        <div className="overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2E8E5] bg-[#F7F9F8] text-xs font-semibold text-[#4A5D55]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Participant Name</th>
                  <th className="px-4 py-3 text-right">Total Payable</th>
                  <th className="px-4 py-3 text-right">Amount Paid</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E5]">
                {participantFinancials.map((p) => (
                  <tr key={p.id} className={!p.is_active ? 'opacity-55' : ''}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#113C2E] whitespace-nowrap">
                      {p.participant_code}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-[#111C18]">
                      {p.full_name}
                      {!p.is_active && ' (Inactive)'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                      {formatINR(p.total_budget)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-[#16794F] tabular-nums">
                      {formatINR(p.amount_paid)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                      {formatINR(p.remaining_balance)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-xs font-semibold ${
                        p.payment_status === 'Paid'
                          ? 'text-[#16794F]'
                          : p.payment_status === 'Partial'
                            ? 'text-[#B45309]'
                            : 'text-[#71857D]'
                      }`}
                    >
                      {p.payment_status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Category Report */}
      {activeTab === 'categories' && (
        <div className="overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2E8E5] bg-[#F7F9F8] text-xs font-semibold text-[#4A5D55]">
                <tr>
                  <th className="px-4 py-3">Expense Category</th>
                  <th className="px-4 py-3 text-right">Transactions</th>
                  <th className="px-4 py-3 text-right">Amount Spent</th>
                  <th className="px-4 py-3 text-right">Share of Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E5]">
                {categoryRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-xs text-[#71857D]">
                      No expense transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  categoryRows.map((c) => (
                    <tr key={c.category}>
                      <td className="px-4 py-3 text-xs font-semibold text-[#111C18]">
                        {c.category}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        {c.count}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#B91C1C] tabular-nums">
                        {formatINR(c.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#4A5D55] tabular-nums">
                        {c.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Daily Report */}
      {activeTab === 'daily' && (
        <div className="overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2E8E5] bg-[#F7F9F8] text-xs font-semibold text-[#4A5D55]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Income</th>
                  <th className="px-4 py-3 text-right">Expenses</th>
                  <th className="px-4 py-3 text-right">Net Cashflow</th>
                  <th className="px-4 py-3 text-right">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E5]">
                {dailyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-xs text-[#71857D]">
                      No daily cashflow activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  dailyRows.map((d) => (
                    <tr key={d.date}>
                      <td className="px-4 py-3 text-xs font-medium text-[#111C18] whitespace-nowrap">
                        {formatDateShort(d.date)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#16794F] tabular-nums">
                        {formatINR(d.income)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#B91C1C] tabular-nums">
                        {formatINR(d.expenses)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums ${
                          d.net >= 0 ? 'text-[#111C18]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {formatINR(d.net)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#4A5D55] tabular-nums">
                        {d.transactionCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
