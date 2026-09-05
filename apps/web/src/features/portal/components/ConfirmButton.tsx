import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

interface ConfirmButtonProps {
  quotationId: string;
  quotationNumber: string;
  status: string;
  grandTotal: number;
  currencyCode: string;
  onConfirmed?: () => void;
}

export default function ConfirmButton({
  quotationId,
  quotationNumber,
  status,
  grandTotal,
  currencyCode,
  onConfirmed,
}: ConfirmButtonProps) {
  const { token } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = status === 'APPROVED' || status === 'UNDER_NEGOTIATION';

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/portal/quotations/${quotationId}/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Confirmation failed');
      }

      setShowModal(false);
      if (onConfirmed) onConfirmed();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  if (status === 'CONFIRMED') {
    return (
      <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/80 px-4 py-2.5 rounded-lg text-emerald-300 text-sm font-medium">
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Quotation Confirmed & In Fulfillment
      </div>
    );
  }

  if (!canConfirm) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-emerald-600/30 text-sm transition flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Accept & Confirm Quotation
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-semibold text-white">Confirm Quotation {quotationNumber}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-gray-300">
              By confirming, you formally agree to the terms, prices, and specifications outlined in this quotation.
            </p>

            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Quotation:</span>
                <span className="font-mono text-gray-200">{quotationNumber}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Grand Total Commitment:</span>
                <span className="font-semibold text-emerald-400">
                  {currencyCode} ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 rounded text-xs">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={confirming}
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirm}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
              >
                {confirming ? 'Confirming...' : 'Yes, Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
