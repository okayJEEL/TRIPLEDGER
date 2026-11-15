import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  BudgetSettings,
  ExpenseTransaction,
  FinancialTotals,
  IncomeTransaction,
  ParticipantFinancialRow,
  ParticipantType,
} from '../types/database';
import { formatDateShort, formatINRPdf } from './formatters';

export interface CategoryReportRow {
  category: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface DailyReportRow {
  date: string;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

export function buildCategoryReport(expenses: ExpenseTransaction[]): CategoryReportRow[] {
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const map = new Map<string, { count: number; amount: number }>();

  for (const e of expenses) {
    const prev = map.get(e.expense_category) ?? { count: 0, amount: 0 };
    map.set(e.expense_category, {
      count: prev.count + 1,
      amount: prev.amount + Number(e.amount),
    });
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      amount: data.amount,
      percentage: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildDailyReport(
  income: IncomeTransaction[],
  expenses: ExpenseTransaction[]
): DailyReportRow[] {
  const map = new Map<string, { income: number; expenses: number; count: number }>();

  for (const tx of income) {
    const prev = map.get(tx.transaction_date) ?? { income: 0, expenses: 0, count: 0 };
    map.set(tx.transaction_date, {
      income: prev.income + Number(tx.amount),
      expenses: prev.expenses,
      count: prev.count + 1,
    });
  }

  for (const tx of expenses) {
    const prev = map.get(tx.transaction_date) ?? { income: 0, expenses: 0, count: 0 };
    map.set(tx.transaction_date, {
      income: prev.income,
      expenses: prev.expenses + Number(tx.amount),
      count: prev.count + 1,
    });
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      transactionCount: data.count,
    }));
}

export function exportReportsToExcel(params: {
  settings: BudgetSettings | null;
  totals: FinancialTotals;
  participantRows: ParticipantFinancialRow[];
  categoryRows: CategoryReportRow[];
  dailyRows: DailyReportRow[];
}): void {
  const { settings, totals, participantRows, categoryRows, dailyRows } = params;
  const wb = XLSX.utils.book_new();

  // 1. Overall Summary Sheet
  const overallData = [
    ['TripLedger Financial Report'],
    ['Trip Name', settings?.trip_name ?? 'Maharashtra Western Ghats Study Tour'],
    [
      'Trip Dates',
      `${formatDateShort(settings?.trip_start_date)} – ${formatDateShort(settings?.trip_end_date)}`,
    ],
    ['Generated On', new Date().toLocaleString('en-IN')],
    [],
    ['Metric', 'Value'],
    ['Active Participants', totals.totalActiveParticipants],
    ['Students', totals.activeStudentsCount],
    ['Faculty', totals.activeFacultyCount],
    ['Expected Budget (INR)', totals.expectedCollection],
    ['Actual Collection (INR)', totals.totalCollected],
    ['Pending Payments (INR)', totals.pendingCollection],
    ['Total Expenses (INR)', totals.totalExpenses],
    ['Available Balance (INR)', totals.availableBalance],
    ['Budget Utilisation (%)', Number(totals.budgetUtilisationPct.toFixed(2))],
  ];
  const wsOverall = XLSX.utils.aoa_to_sheet(overallData);
  XLSX.utils.book_append_sheet(wb, wsOverall, 'Overall Summary');

  // 2. Participant Report Sheet
  const participantSheetData = participantRows.map((p) => ({
    Code: p.participant_code,
    'Full Name': p.full_name,
    Category: p.participant_type === 'faculty' ? 'Faculty' : 'Student',
    Status: p.is_active ? 'Active' : 'Inactive',
    'Total Payable (INR)': p.total_budget,
    'Amount Paid (INR)': p.amount_paid,
    'Remaining Balance (INR)': p.remaining_balance,
    'Payment Status': p.payment_status,
  }));
  const wsParticipants = XLSX.utils.json_to_sheet(participantSheetData);
  XLSX.utils.book_append_sheet(wb, wsParticipants, 'Participant Report');

  // 3. Category Report Sheet
  const categorySheetData = categoryRows.map((c) => ({
    'Expense Category': c.category,
    'Transaction Count': c.count,
    'Amount Spent (INR)': c.amount,
    'Share of Expenses (%)': Number(c.percentage.toFixed(2)),
  }));
  const wsCategories = XLSX.utils.json_to_sheet(categorySheetData);
  XLSX.utils.book_append_sheet(wb, wsCategories, 'Category Report');

  // 4. Daily Report Sheet
  const dailySheetData = dailyRows.map((d) => ({
    Date: d.date,
    'Income (INR)': d.income,
    'Expenses (INR)': d.expenses,
    'Net Balance (INR)': d.net,
    'Transactions': d.transactionCount,
  }));
  const wsDaily = XLSX.utils.json_to_sheet(dailySheetData);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Cashflow');

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `TripLedger_Financial_Report_${stamp}.xlsx`);
}

export function exportActiveTabToCSV(
  tab: 'overall' | 'participants' | 'categories' | 'daily',
  params: {
    totals: FinancialTotals;
    participantRows: ParticipantFinancialRow[];
    categoryRows: CategoryReportRow[];
    dailyRows: DailyReportRow[];
  }
): void {
  let rows: Record<string, unknown>[] = [];
  if (tab === 'overall') {
    rows = [
      { Metric: 'Active Participants', Value: params.totals.totalActiveParticipants },
      { Metric: 'Expected Collection (INR)', Value: params.totals.expectedCollection },
      { Metric: 'Total Collected (INR)', Value: params.totals.totalCollected },
      { Metric: 'Pending Payments (INR)', Value: params.totals.pendingCollection },
      { Metric: 'Total Expenses (INR)', Value: params.totals.totalExpenses },
      { Metric: 'Available Balance (INR)', Value: params.totals.availableBalance },
      {
        Metric: 'Budget Utilisation (%)',
        Value: Number(params.totals.budgetUtilisationPct.toFixed(2)),
      },
    ];
  } else if (tab === 'participants') {
    rows = params.participantRows.map((p) => ({
      Code: p.participant_code,
      Name: p.full_name,
      Type: p.participant_type,
      Active: p.is_active ? 'Yes' : 'No',
      Payable_INR: p.total_budget,
      Paid_INR: p.amount_paid,
      Remaining_INR: p.remaining_balance,
      Payment_Status: p.payment_status,
    }));
  } else if (tab === 'categories') {
    rows = params.categoryRows.map((c) => ({
      Category: c.category,
      Transactions: c.count,
      Amount_Spent_INR: c.amount,
      Percentage: `${c.percentage.toFixed(2)}%`,
    }));
  } else {
    rows = params.dailyRows.map((d) => ({
      Date: d.date,
      Income_INR: d.income,
      Expenses_INR: d.expenses,
      Net_INR: d.net,
      Transactions: d.transactionCount,
    }));
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TripLedger_${tab}_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportsToPDF(params: {
  settings: BudgetSettings | null;
  totals: FinancialTotals;
  participantRows: ParticipantFinancialRow[];
  categoryRows: CategoryReportRow[];
  dailyRows: DailyReportRow[];
}): void {
  const { settings, totals, participantRows, categoryRows, dailyRows } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  // Brand Header
  doc.setFillColor(17, 60, 46);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TripLedger — Financial Report', 40, 34);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${settings?.trip_name ?? 'Maharashtra Western Ghats Study Tour'} | ${formatDateShort(settings?.trip_start_date)} – ${formatDateShort(settings?.trip_end_date)}`,
    40,
    54
  );
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 40, 68);

  // Overall Financial Summary
  doc.setTextColor(17, 28, 24);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Overall Financial Summary', 40, 106);

  autoTable(doc, {
    startY: 114,
    head: [['Metric', 'Value']],
    body: [
      [
        'Active Participants',
        `${totals.totalActiveParticipants} (${totals.activeStudentsCount} Students, ${totals.activeFacultyCount} Faculty)`,
      ],
      ['Expected Collection', formatINRPdf(totals.expectedCollection)],
      ['Total Collected (Actual)', formatINRPdf(totals.totalCollected)],
      ['Pending Payments', formatINRPdf(totals.pendingCollection)],
      ['Total Expenses', formatINRPdf(totals.totalExpenses)],
      ['Available Balance', formatINRPdf(totals.availableBalance)],
      ['Budget Utilisation', `${totals.budgetUtilisationPct.toFixed(1)}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [17, 60, 46], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 5 },
    margin: { left: 40, right: 40 },
  });

  // Category Breakdown
  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Expense Category Breakdown', 40, afterSummaryY);

  autoTable(doc, {
    startY: afterSummaryY + 8,
    head: [['Category', 'Count', 'Amount Spent', 'Share (%)']],
    body:
      categoryRows.length > 0
        ? categoryRows.map((c) => [
            c.category,
            String(c.count),
            formatINRPdf(c.amount),
            `${c.percentage.toFixed(1)}%`,
          ])
        : [['No expense transactions recorded yet', '0', formatINRPdf(0), '0.0%']],
    theme: 'grid',
    headStyles: { fillColor: [22, 121, 79], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 5 },
    margin: { left: 40, right: 40 },
  });

  // Daily Cashflow
  const afterCatY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Daily Cashflow Summary', 40, afterCatY);

  autoTable(doc, {
    startY: afterCatY + 8,
    head: [['Date', 'Income', 'Expenses', 'Net Balance', 'Tx Count']],
    body:
      dailyRows.length > 0
        ? dailyRows.map((d) => [
            formatDateShort(d.date),
            formatINRPdf(d.income),
            formatINRPdf(d.expenses),
            formatINRPdf(d.net),
            String(d.transactionCount),
          ])
        : [['No transactions recorded yet', formatINRPdf(0), formatINRPdf(0), formatINRPdf(0), '0']],
    theme: 'grid',
    headStyles: { fillColor: [17, 60, 46], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 5 },
    margin: { left: 40, right: 40 },
  });

  // Participant Payment Report (new page)
  doc.addPage();
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Participant Payment Ledger', 40, 44);

  autoTable(doc, {
    startY: 54,
    head: [['Code', 'Participant Name', 'Type', 'Payable', 'Paid', 'Remaining', 'Status']],
    body: participantRows.map((p) => [
      p.participant_code,
      p.full_name,
      p.participant_type === 'faculty' ? 'Faculty' : 'Student',
      formatINRPdf(p.total_budget),
      formatINRPdf(p.amount_paid),
      formatINRPdf(p.remaining_balance),
      p.payment_status,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [17, 60, 46], textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 4 },
    margin: { left: 40, right: 40 },
  });

  doc.save(`TripLedger_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface ImportedParticipantRow {
  full_name: string;
  participant_type: ParticipantType;
  phone_number: string | null;
  email: string | null;
  total_budget: number;
  error?: string;
}

export async function parseParticipantImportFile(
  file: File,
  defaultBudget: number
): Promise<ImportedParticipantRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
    defval: '',
  });

  return rawRows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')] = String(v ?? '').trim();
    }

    const fullName =
      normalized.full_name || normalized.name || normalized.participant_name || '';
    const rawType = (
      normalized.participant_type ||
      normalized.type ||
      normalized.category ||
      'student'
    ).toLowerCase();
    const participant_type: ParticipantType = rawType.includes('fac') ? 'faculty' : 'student';
    const phone = normalized.phone_number || normalized.phone || normalized.mobile || '';
    const email = normalized.email || normalized.email_address || '';
    const rawBudget = normalized.total_budget || normalized.budget || '';
    const parsedBudget = rawBudget ? Number(rawBudget.replace(/[^0-9.]/g, '')) : defaultBudget;

    let error: string | undefined;
    if (fullName.trim().length < 2) {
      error = 'Full name must be at least 2 characters';
    } else if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      error = 'Invalid budget amount';
    }

    return {
      full_name: fullName.trim(),
      participant_type,
      phone_number: phone || null,
      email: email || null,
      total_budget: Number.isFinite(parsedBudget) ? parsedBudget : defaultBudget,
      error,
    };
  });
}

export function downloadParticipantImportTemplate(defaultBudget: number): void {
  const rows = [
    {
      full_name: 'Student Full Name',
      participant_type: 'student',
      phone_number: '9876543210',
      email: 'student@example.edu',
      total_budget: defaultBudget,
    },
    {
      full_name: 'Faculty Full Name',
      participant_type: 'faculty',
      phone_number: '9876543211',
      email: 'faculty@example.edu',
      total_budget: defaultBudget,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TripLedger_Participants_Template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
