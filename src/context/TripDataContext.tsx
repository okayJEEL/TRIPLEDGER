import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { RECEIPT_BUCKET, supabase } from '../lib/supabase';
import {
  computeFinancialTotals,
  computeParticipantFinancials,
  validateReceiptFile,
} from '../lib/formatters';
import type {
  AuditLog,
  BudgetSettings,
  ExpenseTransaction,
  FinancialTotals,
  IncomeTransaction,
  Participant,
  ParticipantFinancialRow,
  Profile,
  SyncStatus,
} from '../types/database';
import type { ImportedParticipantRow } from '../lib/exports';
import { useAuth } from './AuthContext';

export interface StorageDocumentItem {
  name: string;
  path: string;
  folder: 'income' | 'expenses' | 'general';
  createdAt: string | null;
  size: number | null;
  mimeType: string | null;
  linkedLabel: string;
  linkedAmount: number | null;
}

interface TripDataContextValue {
  participants: Participant[];
  participantFinancials: ParticipantFinancialRow[];
  incomeTransactions: IncomeTransaction[];
  expenseTransactions: ExpenseTransaction[];
  budgetSettings: BudgetSettings | null;
  auditLogs: AuditLog[];
  profilesMap: Record<string, Profile>;
  totals: FinancialTotals;
  loadingData: boolean;
  dataError: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  refreshAll: (silent?: boolean) => Promise<void>;

  // Admin Mutations
  addParticipant: (input: {
    full_name: string;
    participant_type: 'student' | 'faculty';
    phone_number?: string | null;
    email?: string | null;
    total_budget: number;
    is_active: boolean;
  }) => Promise<{ error: string | null }>;
  updateParticipant: (
    id: string,
    updates: Partial<Omit<Participant, 'id' | 'created_at' | 'updated_at'>>
  ) => Promise<{ error: string | null }>;
  bulkImportParticipants: (
    rows: ImportedParticipantRow[]
  ) => Promise<{ error: string | null; inserted: number }>;

  addIncome: (input: {
    transaction_reference: string;
    participant_id: string | null;
    amount: number;
    payment_method: IncomeTransaction['payment_method'];
    income_category: IncomeTransaction['income_category'];
    transaction_date: string;
    notes?: string | null;
    receipt_file_path?: string | null;
  }) => Promise<{ error: string | null }>;
  updateIncome: (
    id: string,
    updates: Partial<Omit<IncomeTransaction, 'id' | 'created_at' | 'updated_at'>>
  ) => Promise<{ error: string | null }>;
  deleteIncome: (id: string) => Promise<{ error: string | null }>;

  addExpense: (input: {
    transaction_reference: string;
    expense_title: string;
    expense_category: ExpenseTransaction['expense_category'];
    amount: number;
    transaction_date: string;
    payment_method: ExpenseTransaction['payment_method'];
    vendor_or_payee: string;
    description?: string | null;
    receipt_file_path?: string | null;
  }) => Promise<{ error: string | null }>;
  updateExpense: (
    id: string,
    updates: Partial<Omit<ExpenseTransaction, 'id' | 'created_at' | 'updated_at'>>
  ) => Promise<{ error: string | null }>;
  deleteExpense: (id: string) => Promise<{ error: string | null }>;

  updateBudgetSettings: (
    updates: Omit<BudgetSettings, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<{ error: string | null }>;
  applyBudgetToActiveParticipants: (budgetPerPerson: number) => Promise<{ error: string | null }>;

  // Storage & Documents
  uploadReceipt: (
    file: File,
    folder: 'income' | 'expenses' | 'general'
  ) => Promise<{ path: string | null; error: string | null }>;
  getReceiptSignedUrl: (path: string) => Promise<{ url: string | null; error: string | null }>;
  deleteStorageFile: (path: string) => Promise<{ error: string | null }>;
  listAllDocuments: () => Promise<{ items: StorageDocumentItem[]; error: string | null }>;
}

const TripDataContext = createContext<TripDataContextValue | undefined>(undefined);

export function TripDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin } = useAuth();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<IncomeTransaction[]>([]);
  const [expenseTransactions, setExpenseTransactions] = useState<ExpenseTransaction[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!supabase || !user || !profile) return;
      if (!silent) setLoadingData(true);

      try {
        const [
          participantsRes,
          incomeRes,
          expenseRes,
          settingsRes,
          profilesRes,
          auditRes,
        ] = await Promise.all([
          supabase
            .from('participants')
            .select('*')
            .order('participant_code', { ascending: true }),
          supabase
            .from('income_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('expense_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase.from('budget_settings').select('*').limit(1).maybeSingle(),
          supabase.from('profiles').select('*'),
          isAdmin
            ? supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(250)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (participantsRes.error) throw participantsRes.error;
        if (incomeRes.error) throw incomeRes.error;
        if (expenseRes.error) throw expenseRes.error;
        if (settingsRes.error) throw settingsRes.error;

        setParticipants((participantsRes.data ?? []) as Participant[]);
        setIncomeTransactions((incomeRes.data ?? []) as IncomeTransaction[]);
        setExpenseTransactions((expenseRes.data ?? []) as ExpenseTransaction[]);
        setBudgetSettings((settingsRes.data as BudgetSettings | null) ?? null);

        if (profilesRes.data) {
          const map: Record<string, Profile> = {};
          for (const p of profilesRes.data as Profile[]) {
            map[p.id] = p;
          }
          setProfilesMap(map);
        }

        if (isAdmin && auditRes.data) {
          setAuditLogs(auditRes.data as AuditLog[]);
        } else {
          setAuditLogs([]);
        }

        setDataError(null);
        setLastSyncedAt(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to synchronize financial ledger.';
        setDataError(message);
      } finally {
        setLoadingData(false);
      }
    },
    [user, profile, isAdmin]
  );

  const scheduleRealtimeRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshAll(true);
    }, 180);
  }, [refreshAll]);

  // Initial fetch & Single Supabase Realtime Subscription
  useEffect(() => {
    if (!supabase || !user || !profile) {
      setParticipants([]);
      setIncomeTransactions([]);
      setExpenseTransactions([]);
      setBudgetSettings(null);
      setAuditLogs([]);
      setLoadingData(false);
      return;
    }

    refreshAll(false);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setSyncStatus(navigator.onLine ? 'connecting' : 'offline');

    const channel = supabase
      .channel(`trip-ledger-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => scheduleRealtimeRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'income_transactions' },
        () => scheduleRealtimeRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_transactions' },
        () => scheduleRealtimeRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_settings' },
        () => scheduleRealtimeRefresh()
      );

    if (isAdmin) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => scheduleRealtimeRefresh()
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setSyncStatus('connected');
        setLastSyncedAt(new Date());
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setSyncStatus(navigator.onLine ? 'reconnecting' : 'offline');
      } else if (status === 'CLOSED') {
        setSyncStatus('offline');
      }
    });

    channelRef.current = channel;

    const handleOnline = () => {
      setSyncStatus('reconnecting');
      refreshAll(true).then(() => {
        setSyncStatus('connected');
      });
    };

    const handleOffline = () => {
      setSyncStatus('offline');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        refreshAll(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, profile, isAdmin, refreshAll, scheduleRealtimeRefresh]);

  const participantFinancials = useMemo(
    () => computeParticipantFinancials(participants, incomeTransactions),
    [participants, incomeTransactions]
  );

  const totals = useMemo(
    () => computeFinancialTotals(participants, incomeTransactions, expenseTransactions),
    [participants, incomeTransactions, expenseTransactions]
  );

  // Admin CRUD Operations
  const addParticipant: TripDataContextValue['addParticipant'] = useCallback(
    async (input) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.from('participants').insert({
        participant_code: '', // Auto-generated via BEFORE INSERT trigger
        full_name: input.full_name.trim(),
        participant_type: input.participant_type,
        phone_number: input.phone_number?.trim() || null,
        email: input.email?.trim() || null,
        total_budget: input.total_budget,
        is_active: input.is_active,
      });
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [refreshAll]
  );

  const updateParticipant: TripDataContextValue['updateParticipant'] = useCallback(
    async (id, updates) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.from('participants').update(updates).eq('id', id);
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [refreshAll]
  );

  const bulkImportParticipants: TripDataContextValue['bulkImportParticipants'] = useCallback(
    async (rows) => {
      if (!supabase) return { error: 'Supabase not configured', inserted: 0 };
      const valid = rows.filter((r) => !r.error);
      if (valid.length === 0) return { error: 'No valid participant rows to import.', inserted: 0 };

      let inserted = 0;
      for (const row of valid) {
        const { error } = await supabase.from('participants').insert({
          participant_code: '',
          full_name: row.full_name,
          participant_type: row.participant_type,
          phone_number: row.phone_number,
          email: row.email,
          total_budget: row.total_budget,
          is_active: true,
        });
        if (error) {
          await refreshAll(true);
          return { error: `Imported ${inserted} rows, stopped on error: ${error.message}`, inserted };
        }
        inserted += 1;
      }

      await refreshAll(true);
      return { error: null, inserted };
    },
    [refreshAll]
  );

  const addIncome: TripDataContextValue['addIncome'] = useCallback(
    async (input) => {
      if (!supabase || !user) return { error: 'Not authenticated' };
      const { error } = await supabase.from('income_transactions').insert({
        transaction_reference: input.transaction_reference.trim(),
        participant_id: input.participant_id || null,
        amount: input.amount,
        payment_method: input.payment_method,
        income_category: input.income_category,
        transaction_date: input.transaction_date,
        received_by: user.id,
        notes: input.notes?.trim() || null,
        receipt_file_path: input.receipt_file_path || null,
      });
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [user, refreshAll]
  );

  const updateIncome: TripDataContextValue['updateIncome'] = useCallback(
    async (id, updates) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.from('income_transactions').update(updates).eq('id', id);
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [refreshAll]
  );

  const deleteIncome: TripDataContextValue['deleteIncome'] = useCallback(
    async (id) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.from('income_transactions').delete().eq('id', id);
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [refreshAll]
  );

  const addExpense: TripDataContextValue['addExpense'] = useCallback(
    async (input) => {
      if (!supabase || !user) return { error: 'Not authenticated' };
      const { error } = await supabase.from('expense_transactions').insert({
        transaction_reference: input.transaction_reference.trim(),
        expense_title: input.expense_title.trim(),
        expense_category: input.expense_category,
        amount: input.amount,
        transaction_date: input.transaction_date,
        payment_method: input.payment_method,
        vendor_or_payee: input.vendor_or_payee.trim(),
        description: input.description?.trim() || null,
        receipt_file_path: input.receipt_file_path || null,
        entered_by: user.id,
      });
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [user, refreshAll]
  );

  const updateExpense: TripDataContextValue['updateExpense'] = useCallback(
    async (id, updates) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.from('expense_transactions').update(updates).eq('id', id);
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [refreshAll]
  );

  const deleteExpense: TripDataContextValue['deleteExpense'] = useCallback(
    async (id) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.from('expense_transactions').delete().eq('id', id);
      if (error) return { error: error.message };
      await refreshAll(true);
      return { error: null };
    },
    [refreshAll]
  );

  const updateBudgetSettings: TripDataContextValue['updateBudgetSettings'] = useCallback(
    async (updates) => {
      if (!supabase) return { error: 'Supabase not configured' };
      if (budgetSettings) {
        const { error } = await supabase
          .from('budget_settings')
          .update(updates)
          .eq('id', budgetSettings.id);
        if (error) return { error: error.message };
      } else {
        const { error } = await supabase.from('budget_settings').insert(updates);
        if (error) return { error: error.message };
      }
      await refreshAll(true);
      return { error: null };
    },
    [budgetSettings, refreshAll]
  );

  const applyBudgetToActiveParticipants: TripDataContextValue['applyBudgetToActiveParticipants'] =
    useCallback(
      async (budgetPerPerson) => {
        if (!supabase) return { error: 'Supabase not configured' };
        const { error } = await supabase
          .from('participants')
          .update({ total_budget: budgetPerPerson })
          .eq('is_active', true);
        if (error) return { error: error.message };
        await refreshAll(true);
        return { error: null };
      },
      [refreshAll]
    );

  // Storage helpers
  const uploadReceipt: TripDataContextValue['uploadReceipt'] = useCallback(async (file, folder) => {
    if (!supabase) return { path: null, error: 'Supabase not configured' };
    const validationError = validateReceiptFile(file);
    if (validationError) return { path: null, error: validationError };

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const monthFolder = new Date().toISOString().slice(0, 7);
    const uniquePrefix = crypto.randomUUID().slice(0, 8);
    const objectPath = `${folder}/${monthFolder}/${uniquePrefix}_${safeName}`;

    const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) return { path: null, error: error.message };
    return { path: objectPath, error: null };
  }, []);

  const getReceiptSignedUrl: TripDataContextValue['getReceiptSignedUrl'] = useCallback(
    async (path) => {
      if (!supabase) return { url: null, error: 'Supabase not configured' };
      const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(path, 3600);
      if (error) return { url: null, error: error.message };
      return { url: data.signedUrl, error: null };
    },
    []
  );

  const deleteStorageFile: TripDataContextValue['deleteStorageFile'] = useCallback(
    async (path) => {
      if (!supabase) return { error: 'Supabase not configured' };
      const { error } = await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
      if (error) return { error: error.message };
      return { error: null };
    },
    []
  );

  const listAllDocuments: TripDataContextValue['listAllDocuments'] = useCallback(async () => {
    if (!supabase) return { items: [], error: 'Supabase not configured' };

    const incomeByPath = new Map<string, IncomeTransaction>();
    for (const tx of incomeTransactions) {
      if (tx.receipt_file_path) incomeByPath.set(tx.receipt_file_path, tx);
    }
    const expenseByPath = new Map<string, ExpenseTransaction>();
    for (const tx of expenseTransactions) {
      if (tx.receipt_file_path) expenseByPath.set(tx.receipt_file_path, tx);
    }

    const collectFolder = async (
      folder: 'income' | 'expenses' | 'general'
    ): Promise<StorageDocumentItem[]> => {
      const results: StorageDocumentItem[] = [];
      const { data: entries, error } = await supabase!.storage
        .from(RECEIPT_BUCKET)
        .list(folder, { limit: 100 });
      if (error || !entries) return results;

      for (const entry of entries) {
        if (!entry.id) {
          // Subdirectory (e.g. YYYY-MM)
          const subPath = `${folder}/${entry.name}`;
          const { data: subFiles } = await supabase!.storage
            .from(RECEIPT_BUCKET)
            .list(subPath, { limit: 200 });
          if (subFiles) {
            for (const f of subFiles) {
              if (!f.id) continue;
              const fullPath = `${subPath}/${f.name}`;
              const inc = incomeByPath.get(fullPath);
              const exp = expenseByPath.get(fullPath);
              results.push({
                name: f.name,
                path: fullPath,
                folder,
                createdAt: f.created_at ?? null,
                size: (f.metadata?.size as number | undefined) ?? null,
                mimeType: (f.metadata?.mimetype as string | undefined) ?? null,
                linkedLabel: inc
                  ? `Income · ${inc.transaction_reference}`
                  : exp
                    ? `Expense · ${exp.expense_title}`
                    : folder === 'general'
                      ? 'General Trip Document'
                      : 'Unlinked Receipt',
                linkedAmount: inc ? Number(inc.amount) : exp ? Number(exp.amount) : null,
              });
            }
          }
        } else {
          const fullPath = `${folder}/${entry.name}`;
          const inc = incomeByPath.get(fullPath);
          const exp = expenseByPath.get(fullPath);
          results.push({
            name: entry.name,
            path: fullPath,
            folder,
            createdAt: entry.created_at ?? null,
            size: (entry.metadata?.size as number | undefined) ?? null,
            mimeType: (entry.metadata?.mimetype as string | undefined) ?? null,
            linkedLabel: inc
              ? `Income · ${inc.transaction_reference}`
              : exp
                ? `Expense · ${exp.expense_title}`
                : 'General Trip Document',
            linkedAmount: inc ? Number(inc.amount) : exp ? Number(exp.amount) : null,
          });
        }
      }
      return results;
    };

    try {
      const [incDocs, expDocs, genDocs] = await Promise.all([
        collectFolder('income'),
        collectFolder('expenses'),
        collectFolder('general'),
      ]);
      const all = [...incDocs, ...expDocs, ...genDocs].sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      );
      return { items: all, error: null };
    } catch (err) {
      return {
        items: [],
        error: err instanceof Error ? err.message : 'Unable to list storage documents.',
      };
    }
  }, [incomeTransactions, expenseTransactions]);

  const value: TripDataContextValue = {
    participants,
    participantFinancials,
    incomeTransactions,
    expenseTransactions,
    budgetSettings,
    auditLogs,
    profilesMap,
    totals,
    loadingData,
    dataError,
    syncStatus,
    lastSyncedAt,
    refreshAll,
    addParticipant,
    updateParticipant,
    bulkImportParticipants,
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    updateBudgetSettings,
    applyBudgetToActiveParticipants,
    uploadReceipt,
    getReceiptSignedUrl,
    deleteStorageFile,
    listAllDocuments,
  };

  return <TripDataContext.Provider value={value}>{children}</TripDataContext.Provider>;
}

export function useTripData() {
  const ctx = useContext(TripDataContext);
  if (!ctx) throw new Error('useTripData must be used within TripDataProvider');
  return ctx;
}
