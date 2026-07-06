import { FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/houses';

interface ThrowAwayFlowProps {
  uuid: string;
  item: InventoryItem;
  onSaved: () => void;
}

// Records binning some of an inventory item: decrements `remaining` exactly
// like EatFlow does (clamped at zero, item never deleted), but nothing was
// eaten so there is no food-diary step — thrown-away food must never reach
// Google Health. The amount prefills with what's left, since the common case
// is binning the whole thing once it's expired.
export default function ThrowAwayFlow({ uuid, item, onSaved }: ThrowAwayFlowProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openPanel() {
    setError(null);
    setAmount(String(item.remaining));
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const thrown = parseFloat(amount);
      const newRemaining = Math.max(0, item.remaining - (Number.isFinite(thrown) ? thrown : 0));

      const body: CreateInventoryItem & { remaining: number } = {
        name: item.name,
        measure: item.measure,
        amount: item.amount,
        remaining: newRemaining,
        expiration: item.expiration,
        ...(item.barcode ? { barcode: item.barcode } : {}),
        ...(item.image ? { image: item.image } : {}),
      };
      const res = await apiFetch(`/api/inventory/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Failed to update amount. Please try again.');
        return;
      }

      onSaved();
      closePanel();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Sits directly above EatFlow's FAB (bottom-6 + 14 height + a gap). */}
      <button
        type="button"
        aria-label="Throw away"
        title="Throw away"
        onClick={openPanel}
        className="fixed bottom-24 right-[max(1rem,calc(50vw_-_40ch))] z-50 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-secondary leading-none text-white shadow-lg transition transition-transform hover:scale-110 hover:bg-secondary/90 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-secondary/60 focus:ring-offset-2"
      >
        <span className="text-2xl" aria-hidden="true">🗑</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={closePanel}
        >
          <div
            className="w-full max-w-[80ch] rounded-t-lg border-2 border-secondary bg-black p-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold">Throw away {item.name}</h4>
              <button type="button" aria-label="Close" onClick={closePanel} className="cursor-pointer text-xl leading-none">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3">
              <div>
                <label htmlFor="amount-thrown-away" className="mb-1 block text-sm">
                  Amount thrown away
                </label>
                <input
                  id="amount-thrown-away"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-24 p-2 text-base"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting || !amount} className="cursor-pointer px-2 py-1 text-sm">
                {submitting ? 'Saving...' : 'Throw away'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
