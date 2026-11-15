export type UserRole = 'admin' | 'faculty_viewer';

export type ParticipantType = 'student' | 'faculty';

export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';

export type IncomeCategory =
  | 'Advance Payment'
  | 'Remaining Payment'
  | 'Full Payment'
  | 'Additional Contribution'
  | 'Other Income';

export type ExpenseCategory =
  | 'Accommodation'
  | 'Food and Refreshments'
  | 'Transportation'
  | 'Fuel'
  | 'Entry Tickets and Permits'
  | 'Research and Educational Activities'
  | 'Equipment and Materials'
  | 'Emergency Expenses'
  | 'Miscellaneous'
  | 'Other';

export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

export type SyncStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  participant_code: string;
  full_name: string;
  participant_type: ParticipantType;
  phone_number: string | null;
  email: string | null;
  total_budget: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncomeTransaction {
  id: string;
  transaction_reference: string;
  participant_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  income_category: IncomeCategory;
  transaction_date: string;
  received_by: string | null;
  notes: string | null;
  receipt_file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseTransaction {
  id: string;
  transaction_reference: string;
  expense_title: string;
  expense_category: ExpenseCategory;
  amount: number;
  transaction_date: string;
  payment_method: PaymentMethod;
  vendor_or_payee: string;
  description: string | null;
  receipt_file_path: string | null;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetSettings {
  id: string;
  trip_name: string;
  trip_start_date: string;
  trip_end_date: string;
  currency: string;
  budget_per_person: number;
  expected_advance: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export interface ParticipantFinancialRow extends Participant {
  amount_paid: number;
  remaining_balance: number;
  payment_status: PaymentStatus;
  transaction_count: number;
}

export interface FinancialTotals {
  totalActiveParticipants: number;
  activeStudentsCount: number;
  activeFacultyCount: number;
  inactiveParticipantsCount: number;
  expectedCollection: number;
  totalCollected: number;
  pendingCollection: number;
  totalExpenses: number;
  availableBalance: number;
  budgetUtilisationPct: number;
  collectionProgressPct: number;
}

export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Other'];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Advance Payment',
  'Remaining Payment',
  'Full Payment',
  'Additional Contribution',
  'Other Income',
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Accommodation',
  'Food and Refreshments',
  'Transportation',
  'Fuel',
  'Entry Tickets and Permits',
  'Research and Educational Activities',
  'Equipment and Materials',
  'Emergency Expenses',
  'Miscellaneous',
  'Other',
];
