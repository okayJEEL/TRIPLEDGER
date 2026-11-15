import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, X, AlertCircle } from 'lucide-react';
import { useTripData } from '../context/TripDataContext';

interface ReceiptPreviewModalProps {
  filePath: string | null;
  title?: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({ filePath, title, onClose }: ReceiptPreviewModalProps) {
  const { getReceiptSignedUrl } = useTripData();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getReceiptSignedUrl(filePath).then(({ url, error: err }) => {
      if (cancelled) return;
      if (err || !url) {
        setError(err ?? 'Unable to generate secure file link.');
      } else {
        setSignedUrl(url);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filePath, getReceiptSignedUrl]);

  if (!filePath) return null;

  const isPdf = filePath.toLowerCase().endsWith('.pdf');
  const fileName = filePath.split('/').pop() ?? 'receipt';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D15]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt Document Preview"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#E2E8E5] px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[#111C18]">
              {title || 'Receipt Preview'}
            </h3>
            <p className="truncate font-mono text-xs text-[#71857D] mt-0.5">{fileName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {signedUrl && (
              <>
                <a
                  href={signedUrl}
                  download={fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8E5] bg-white px-3 py-1.5 text-xs font-medium text-[#111C18] hover:bg-[#F7F9F8] transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#113C2E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#174E3B] transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Tab
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0] hover:text-[#111C18] transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F7F9F8] p-4 flex items-center justify-center min-h-[340px]">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-[#4A5D55]">
              <Loader2 className="h-6 w-6 animate-spin text-[#16794F]" />
              <p className="text-sm">Authorising private receipt access...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-[#B91C1C]/20 bg-white p-6 text-center">
              <AlertCircle className="h-6 w-6 text-[#B91C1C]" />
              <p className="text-sm font-medium text-[#111C18]">Preview Unavailable</p>
              <p className="text-xs text-[#4A5D55]">{error}</p>
            </div>
          )}

          {!loading && !error && signedUrl && isPdf && (
            <div className="w-full h-[65vh] rounded-lg border border-[#E2E8E5] bg-white overflow-hidden">
              <iframe
                src={signedUrl}
                title={fileName}
                className="h-full w-full"
              />
            </div>
          )}

          {!loading && !error && signedUrl && !isPdf && (
            <img
              src={signedUrl}
              alt={title || fileName}
              referrerPolicy="no-referrer"
              className="max-h-[68vh] w-auto rounded-lg border border-[#E2E8E5] bg-white object-contain shadow-sm"
            />
          )}

          {!loading && !error && !signedUrl && (
            <div className="flex flex-col items-center gap-2 text-[#71857D]">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No document found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
