import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Search,
  Upload,
  Trash2,
  Eye,
  Loader2,
  FolderLock,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTripData, type StorageDocumentItem } from '../context/TripDataContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime, formatINR, validateReceiptFile } from '../lib/formatters';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import { ConfirmModal } from '../components/ConfirmModal';

export function DocumentsPage() {
  const { isAdmin } = useAuth();
  const { listAllDocuments, uploadReceipt, deleteStorageFile } = useTripData();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState<StorageDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<'all' | 'income' | 'expenses' | 'general'>('all');
  const [uploading, setUploading] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<{ path: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorageDocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { items, error } = await listAllDocuments();
    setLoading(false);
    if (error) {
      showToast('error', 'Storage error', error);
    } else {
      setDocuments(items);
    }
  }, [listAllDocuments, showToast]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (folderFilter !== 'all' && doc.folder !== folderFilter) return false;
      if (!q) return true;
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.linkedLabel.toLowerCase().includes(q)
      );
    });
  }, [documents, folderFilter, search]);

  const handleUploadGeneral = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;

    const err = validateReceiptFile(file);
    if (err) {
      showToast('error', 'Invalid document', err);
      return;
    }

    setUploading(true);
    const { error } = await uploadReceipt(file, 'general');
    setUploading(false);

    if (error) {
      showToast('error', 'Upload failed', error);
    } else {
      showToast('success', 'Document uploaded', `${file.name} stored privately.`);
      loadDocs();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error } = await deleteStorageFile(deleteTarget.path);
    setDeleting(false);
    if (error) {
      showToast('error', 'Could not delete file', error);
    } else {
      showToast('success', 'File deleted', deleteTarget.name);
      setDeleteTarget(null);
      loadDocs();
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[#111C18]">
            Receipts & Document Vault
          </h2>
          <p className="mt-0.5 text-xs text-[#4A5D55]">
            Private Supabase Storage (`trip-receipts`) · Authorised signed-URL access only
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadDocs}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-3.5 py-2 text-xs font-semibold text-[#111C18] hover:bg-[#F7F9F8]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {isAdmin && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#113C2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174E3B] whitespace-nowrap shrink-0">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Uploading...' : 'Upload Document'}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleUploadGeneral}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#E2E8E5] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71857D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or linked transaction..."
              className="w-full rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] py-2 pl-9 pr-3 text-sm focus:border-[#16794F] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EEF3F0] p-1">
            {(
              [
                { id: 'all', label: 'All Files' },
                { id: 'income', label: 'Income Receipts' },
                { id: 'expenses', label: 'Expense Bills' },
                { id: 'general', label: 'General' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderFilter(f.id)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  folderFilter === f.id
                    ? 'bg-white text-[#111C18] shadow-xs'
                    : 'text-[#4A5D55] hover:text-[#111C18]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-[#E2E8E5] bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5D0] bg-white p-12 text-center">
          <FolderLock className="h-9 w-9 text-[#71857D]" />
          <p className="mt-3 text-sm font-semibold text-[#111C18]">No documents stored yet</p>
          <p className="mt-1 max-w-sm text-xs text-[#71857D]">
            Receipts uploaded on Income or Expense transactions and general tour documents appear
            here with private signed-URL access.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const isPdf = doc.name.toLowerCase().endsWith('.pdf');
            return (
              <div
                key={doc.path}
                className="flex flex-col justify-between rounded-2xl border border-[#E2E8E5] bg-white p-4 transition-colors hover:border-[#CBD5D0]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3F0] text-[#113C2E]">
                    {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111C18]">{doc.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#4A5D55]">{doc.linkedLabel}</p>
                    <p className="mt-1 text-[11px] text-[#71857D] font-mono tabular-nums">
                      {formatSize(doc.size)} · {formatDateTime(doc.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#E2E8E5] pt-3">
                  <span className="font-mono text-xs font-semibold text-[#111C18] tabular-nums">
                    {doc.linkedAmount !== null ? formatINR(doc.linkedAmount) : doc.folder}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({ path: doc.path, title: `${doc.linkedLabel} — ${doc.name}` })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E5] px-2.5 py-1 text-xs font-medium text-[#111C18] hover:bg-[#F7F9F8]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(doc)}
                        className="rounded-lg p-1.5 text-[#B91C1C] hover:bg-[#FEE2E2]"
                        title="Delete file from storage"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReceiptPreviewModal
        filePath={previewDoc?.path ?? null}
        title={previewDoc?.title}
        onClose={() => setPreviewDoc(null)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Stored File"
        description={`Permanently delete "${deleteTarget?.name}" from private Supabase Storage?`}
        confirmLabel="Delete File"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
