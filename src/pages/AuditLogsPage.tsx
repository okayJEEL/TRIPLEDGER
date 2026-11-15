import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { useTripData } from '../context/TripDataContext';
import { formatDateTime } from '../lib/formatters';

export function AuditLogsPage() {
  const { auditLogs, profilesMap } = useTripData();
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return auditLogs.filter((log) => {
      if (tableFilter !== 'all' && log.table_name !== tableFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      return true;
    });
  }, [auditLogs, tableFilter, actionFilter]);

  const actionTone = (action: string) => {
    if (action === 'INSERT') return 'text-[#16794F]';
    if (action === 'UPDATE') return 'text-[#B45309]';
    return 'text-[#B91C1C]';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18]">Immutable Audit Logs</h2>
          <p className="mt-0.5 text-xs text-[#4A5D55]">
            Automatic PostgreSQL trigger log of all inserts, updates, and deletions · Read-only even for administrators
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#113C2E]">
          <ShieldAlert className="h-4 w-4 text-[#16794F]" />
          <span>{auditLogs.length} recorded events</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2E8E5] bg-white p-4">
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs font-medium focus:border-[#16794F] focus:outline-none"
        >
          <option value="all">All Tables</option>
          <option value="participants">participants</option>
          <option value="income_transactions">income_transactions</option>
          <option value="expense_transactions">expense_transactions</option>
          <option value="budget_settings">budget_settings</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs font-medium focus:border-[#16794F] focus:outline-none"
        >
          <option value="all">All Actions</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {/* Audit Trail List */}
      <div className="overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#71857D]">
            No audit events recorded for the selected filters.
          </p>
        ) : (
          <div className="divide-y divide-[#E2E8E5]">
            {filtered.map((log) => {
              const actor = log.user_id ? profilesMap[log.user_id] : null;
              const isOpen = expandedId === log.id;
              return (
                <div key={log.id} className="p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : log.id)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#71857D]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#71857D]" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111C18]">
                          <span className={`font-mono ${actionTone(log.action)}`}>{log.action}</span>
                          {' · '}
                          <span className="font-mono text-[#113C2E]">{log.table_name}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#71857D]">
                          Actor: {actor ? `${actor.full_name} (${actor.email})` : 'System / SQL Migration'}
                          {' · '}
                          Record: <span className="font-mono">{log.record_id.slice(0, 8)}</span>
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#71857D] shrink-0">
                      {formatDateTime(log.created_at)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#E2E8E5] pt-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-[#71857D]">Previous Values</p>
                        <pre className="max-h-56 overflow-auto rounded-xl bg-[#F7F9F8] p-3 font-mono text-[11px] text-[#4A5D55]">
                          {log.old_values ? JSON.stringify(log.old_values, null, 2) : 'null'}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-[#71857D]">Updated Values</p>
                        <pre className="max-h-56 overflow-auto rounded-xl bg-[#F7F9F8] p-3 font-mono text-[11px] text-[#111C18]">
                          {log.new_values ? JSON.stringify(log.new_values, null, 2) : 'null'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
