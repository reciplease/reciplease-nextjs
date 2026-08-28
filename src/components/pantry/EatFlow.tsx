import { useActionState, useState } from 'react';
import { apiFetch } from '@/lib/houses';

interface EatFlowProps {
  uuid: string;
  item: PantryItem;
  onSaved: () => void;
}

// Records eating some of a pantry item: always decrements `remaining`
// (clamped at zero, never below — emptying it archives and deletes the item
// server-side, so it simply won't be there next time the pantry list or this
// item's own page refetches). The FAB and the panel it opens live in the
// same component since neither is useful alone.
//
// This used to also (optionally) log the same amount to Google Health's food
// diary via a food-matching sub-flow, but that only ever covered eating a
// single pantry item, not a full planned meal — pulled out for now.
// See TODO.md ("Google Health eat logging") before reintroducing it.
export default function EatFlow({ uuid, item, onSaved }: EatFlowProps) {
  const [open, setOpen] = useState(false);
  // Bumped on every open, and used as the panel's key: forces it to remount
  // with fresh useActionState/amountEaten state rather than reopening onto a
  // stale error or amount left over from a previous attempt.
  const [openKey, setOpenKey] = useState(0);

  function openPanel() {
    setOpenKey((k) => k + 1);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
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
        <EatPanel key={openKey} uuid={uuid} item={item} onSaved={onSaved} onClose={closePanel} />
      )}
    </>
  );
}

function EatPanel({
  uuid,
  item,
  onSaved,
  onClose,
}: {
  uuid: string;
  item: PantryItem;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [amountEaten, setAmountEaten] = useState('');

  const [error, handleSubmit, submitting] = useActionState(async (): Promise<string | null> => {
    const eaten = parseFloat(amountEaten);
    try {
      const newRemaining = Math.max(0, item.remaining - (Number.isFinite(eaten) ? eaten : 0));

      const body: CreatePantryItem & { remaining: number } = {
        name: item.name,
        measure: item.measure,
        amount: item.amount,
        remaining: newRemaining,
        expiration: item.expiration,
        ...(item.barcode ? { barcode: item.barcode } : {}),
        ...(item.image ? { image: item.image } : {}),
      };
      const res = await apiFetch(`/api/pantry/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return 'Failed to update amount. Please try again.';
      }

      onSaved();
      onClose();
      return null;
    } catch {
      return 'An unexpected error occurred.';
    }
  }, null);

  // Pre-fills the amount with everything that's left, so the user doesn't
  // have to look it up and type it themselves — still goes through the
  // normal Save button, same as typing it in by hand would.
  function handleEatAll() {
    setAmountEaten(String(item.remaining));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[80ch] rounded-t-lg border-2 border-secondary bg-black p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-lg font-semibold">Log {item.name} eaten</h4>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-xl leading-none">
            ×
          </button>
        </div>

        <form action={handleSubmit} className="grid gap-3">
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
  );
}
