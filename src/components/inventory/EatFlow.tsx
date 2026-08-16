import { FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/houses';

interface EatFlowProps {
  uuid: string;
  item: InventoryItem;
  onSaved: () => void;
}

// Records eating some of an inventory item: always decrements `remaining`
// (clamped at zero, never below — emptying it archives and deletes the item
// server-side, so it simply won't be there next time the pantry list or this
// item's own page refetches). The FAB and the panel it opens live in the
// same component since neither is useful alone.
//
// This used to also (optionally) log the same amount to Google Health's food
// diary via a food-matching sub-flow, but that only ever covered eating a
// single inventory item, not a full planned meal — pulled out for now.
// See TODO.md ("Google Health eat logging") before reintroducing it.
export default function EatFlow({ uuid, item, onSaved }: EatFlowProps) {
  const [open, setOpen] = useState(false);
  const [amountEaten, setAmountEaten] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openPanel() {
    setError(null);
    setAmountEaten('');
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
  }

  // Shared by the form's typed-amount submit and the "Ate it all" shortcut
  // below, so both go through the same save/close sequence.
  async function submitAmount(eaten: number) {
    setError(null);
    setSubmitting(true);
    try {
      const newRemaining = Math.max(0, item.remaining - (Number.isFinite(eaten) ? eaten : 0));

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    return submitAmount(parseFloat(amountEaten));
  }

  // Pre-fills the amount with everything that's left, so the user doesn't
  // have to look it up and type it themselves — still goes through the
  // normal Save button, same as typing it in by hand would.
  function handleEatAll() {
    setAmountEaten(String(item.remaining));
  }

  return (
    <>
      <button
        type="button"
        aria-label="Log eaten"
        title="Log eaten"
        onClick={openPanel}
        className="fixed bottom-6 right-[max(1rem,calc(50vw_-_40ch))] z-50 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-highlight leading-none text-white shadow-lg transition transition-transform hover:scale-110 hover:bg-highlight/90 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-highlight/60 focus:ring-offset-2"
      >
        <span className="-mt-0.5 text-3xl">−</span>
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
              <h4 className="text-lg font-semibold">Log {item.name} eaten</h4>
              <button type="button" aria-label="Close" onClick={closePanel} className="cursor-pointer text-xl leading-none">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3">
              <div>
                <label htmlFor="amount-eaten" className="mb-1 block text-sm">
                  Amount eaten
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="amount-eaten"
                    type="number"
                    min="0"
                    step="any"
                    value={amountEaten}
                    onChange={(e) => setAmountEaten(e.target.value)}
                    className="w-24 p-2 text-base"
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleEatAll}
                    className="cursor-pointer border-0 bg-transparent p-0 text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ate it all
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting || !amountEaten} className="cursor-pointer px-2 py-1 text-sm">
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
