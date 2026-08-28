import { useActionState, useState } from 'react';
import { binPantryItem } from '@/lib/pantry';

interface ThrowAwayPanelProps {
  uuid: string;
  item: PantryItem;
  onSaved: () => void;
  onClose: () => void;
}

// The bottom-sheet form itself, shared by ThrowAwayFlow's detail-page FAB and
// the inline quick-action on the pantry/expiring-soon list tiles — only the
// trigger differs between those two call sites, not the panel.
export default function ThrowAwayPanel({ uuid, item, onSaved, onClose }: ThrowAwayPanelProps) {
  const [amount, setAmount] = useState(String(item.remaining));

  const [error, handleSubmit, submitting] = useActionState(async (): Promise<string | null> => {
    try {
      const thrown = parseFloat(amount);
      const ok = await binPantryItem(uuid, item, thrown);
      if (!ok) {
        return 'Failed to update amount. Please try again.';
      }
      onSaved();
      onClose();
      return null;
    } catch {
      return 'An unexpected error occurred.';
    }
  }, null);

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
          <h4 className="text-lg font-semibold">Throw away {item.name}</h4>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-xl leading-none">
            ×
          </button>
        </div>

        <form action={handleSubmit} className="grid gap-3">
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
  );
}
