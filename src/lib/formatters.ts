import type {
  ExpenseTransaction,
  FinancialTotals,
  IncomeTransaction,
  Participant,
  ParticipantFinancialRow,
  PaymentStatus,
} from '../types/database';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrNumberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

export function formatINR(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return showDecimals ? inrDecimalFormatter.format(safe) : inrFormatter.format(safe);
}

export function formatINRPdf(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}Rs. ${inrNumberFormatter.format(Math.abs(safe))}`;
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeOnly(date: Date | null): string {
  if (!date) return 'Not synced yet';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateTransactionReference(prefix: 'INC' | 'EXP'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export function getNextParticipantCode(
  participants: Participant[],
  type: 'student' | 'faculty'
): string {
  const prefix = type === 'faculty' ? 'FAC' : 'STU';
  let maxNum = 0;
  for (const p of participants) {
    if (p.participant_code.startsWith(prefix)) {
      const numeric = parseInt(p.participant_code.slice(prefix.length), 10);
      if (!Number.isNaN(numeric) && numeric > maxNum) {
        maxNum = numeric;
      }
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

export function validateReceiptFile(file: File): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
  const lowerName = file.name.toLowerCase();
  const hasValidExt = allowedExts.some((ext) => lowerName.endsWith(ext));

  if (!allowedTypes.includes(file.type) && !hasValidExt) {
    return 'Unsupported file format. Only JPG, JPEG, PNG, and PDF files are allowed.';
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'File exceeds the 10 MB size limit.';
  }
  return null;
}

export function computeParticipantFinancials(
  participants: Participant[],
  incomeTransactions: IncomeTransaction[]
): ParticipantFinancialRow[] {
  const paidByParticipant = new Map<string, { total: number; count: number }>();

  for (const tx of incomeTransactions) {
    if (!tx.participant_id) continue;
    const current = paidByParticipant.get(tx.participant_id) ?? { total: 0, count: 0 };
    paidByParticipant.set(tx.participant_id, {
      total: current.total + Number(tx.amount),
      count: current.count + 1,
    });
  }

  return participants.map((p) => {
    const record = paidByParticipant.get(p.id) ?? { total: 0, count: 0 };
    const budget = Number(p.total_budget) || 0;
    const paid = record.total;
    const remaining = Math.max(0, budget - paid);

    let status: PaymentStatus = 'Unpaid';
    if (paid >= budget && budget > 0) {
      status = 'Paid';
    } else if (paid > 0) {
      status = 'Partial';
    }

    return {
      ...p,
      total_budget: budget,
      amount_paid: paid,
      remaining_balance: remaining,
      payment_status: status,
      transaction_count: record.count,
    };
  });
}

export function computeFinancialTotals(
  participants: Participant[],
  incomeTransactions: IncomeTransaction[],
  expenseTransactions: ExpenseTransaction[]
): FinancialTotals {
  const active = participants.filter((p) => p.is_active);
  const activeStudentsCount = active.filter((p) => p.participant_type === 'student').length;
  const activeFacultyCount = active.filter((p) => p.participant_type === 'faculty').length;
  const inactiveParticipantsCount = participants.length - active.length;

  const expectedCollection = active.reduce((sum, p) => sum + (Number(p.total_budget) || 0), 0);
  const totalCollected = incomeTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const pendingCollection = Math.max(0, expectedCollection - totalCollected);
  const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const availableBalance = totalCollected - totalExpenses;

  const budgetUtilisationPct =
    expectedCollection > 0 ? Math.min(999, (totalExpenses / expectedCollection) * 100) : 0;
  const collectionProgressPct =
    expectedCollection > 0 ? Math.min(100, (totalCollected / expectedCollection) * 100) : 0;

  return {
    totalActiveParticipants: active.length,
    activeStudentsCount,
    activeFacultyCount,
    inactiveParticipantsCount,
    expectedCollection,
    totalCollected,
    pendingCollection,
    totalExpenses,
    availableBalance,
    budgetUtilisationPct,
    collectionProgressPct,
  };
}
