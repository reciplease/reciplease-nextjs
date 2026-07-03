import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/houses';
import { useGoogleHealthConnection, MEAL_TYPES, type GoogleHealthFood } from '@/lib/googleHealth';

const SEARCH_DEBOUNCE_MS = 400;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EatFlowProps {
  uuid: string;
  item: InventoryItem;
  onSaved: () => void;
}

// Records eating some of an inventory item: always decrements `remaining`
// (clamped at zero, never below — a fully-consumed item stays around rather
// than being deleted, so it can still show up greyed-out/sorted-last on the
// pantry page, the same treatment expired items get), and — when Google
// Health is linked — optionally logs the same amount to Google Health's food
// diary. The FAB and the panel it opens live in the same component since
// neither is useful alone.
export default function EatFlow({ uuid, item, onSaved }: EatFlowProps) {
  const { data: connection } = useGoogleHealthConnection();
  const googleHealthConnected = connection?.connected ?? false;

  const [open, setOpen] = useState(false);
  const [amountEaten, setAmountEaten] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleHealthError, setGoogleHealthError] = useState<string | null>(null);

  const [query, setQuery] = useState(item.name);
  const [results, setResults] = useState<GoogleHealthFood[]>([]);
  const [selectedFood, setSelectedFood] = useState<GoogleHealthFood | null>(null);
  const [mealType, setMealType] = useState<string>(MEAL_TYPES[0]?.value ?? 'SNACK');
  const [date, setDate] = useState(today());

  function openPanel() {
    setError(null);
    setGoogleHealthError(null);
    setAmountEaten('');
    setQuery(item.name);
    setResults([]);
    setSelectedFood(null);
    setMealType(MEAL_TYPES[0]?.value ?? 'SNACK');
    setDate(today());
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
  }

  // Debounced Google Health food search, only while the panel is open and
  // Google Health is linked — no point querying otherwise. Doesn't reset
  // `results` itself when those conditions aren't met (that would be a
  // synchronous setState in an effect body, triggering an extra cascading
  // render) — searchable below instead derives whether to show stale results
  // from the same conditions.
  useEffect(() => {
    if (!open || !googleHealthConnected || !query.trim()) return;
    const handle = setTimeout(() => {
      apiFetch(`/api/google-health/foods/search?query=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((foods: GoogleHealthFood[]) => setResults(Array.isArray(foods) ? foods : []))
        .catch(() => setResults([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, googleHealthConnected, query]);

  const searchable = open && googleHealthConnected && query.trim().length > 0;
  const visibleResults = searchable ? results : [];

  function selectFood(food: GoogleHealthFood) {
    setSelectedFood(food);
    setResults([]);
  }

  function clearSelectedFood() {
    setSelectedFood(null);
  }

  /** Logs to Google Health if a food was matched and its fields are complete.
   * Returns false only when a log was attempted and failed — the caller uses
   * that to decide whether to leave the panel open with the error visible. */
  async function maybeLogGoogleHealth(amount: number): Promise<boolean> {
    if (!selectedFood || !mealType || !date) return true;
    try {
      const res = await apiFetch('/api/google-health/foods/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodId: selectedFood.foodId,
          foodDisplayName: selectedFood.displayName,
          mealType,
          date,
          amount,
        }),
      });
      if (!res.ok) {
        setGoogleHealthError('Your inventory was updated, but logging to Google Health failed. Please try again.');
        return false;
      }
      return true;
    } catch {
      setGoogleHealthError('Your inventory was updated, but logging to Google Health failed. Please try again.');
      return false;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGoogleHealthError(null);
    setSubmitting(true);
    try {
      const eaten = parseFloat(amountEaten);
      // Clamped at zero rather than deleting the item — a fully-consumed item
      // just sorts to the end and greys out on the pantry page instead.
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
      const googleHealthOk = await maybeLogGoogleHealth(eaten);
      if (googleHealthOk) {
        closePanel();
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
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
                <input
                  id="amount-eaten"
                  type="number"
                  min="0"
                  step="any"
                  value={amountEaten}
                  onChange={(e) => setAmountEaten(e.target.value)}
                  className="w-24 p-2 text-base"
                />
              </div>

              {googleHealthConnected && (
                <div className="grid gap-2 border-t border-secondary pt-3">
                  <label htmlFor="google-health-search" className="text-sm">
                    Match to a Google Health food (optional)
                  </label>
                  <input
                    id="google-health-search"
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      clearSelectedFood();
                    }}
                    className="w-full p-2 text-base"
                  />

                  {!selectedFood && visibleResults.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto rounded border border-secondary">
                      {visibleResults.map((food) => (
                        <li key={food.foodId}>
                          <button
                            type="button"
                            onClick={() => selectFood(food)}
                            className="w-full cursor-pointer px-2 py-1 text-left text-sm hover:bg-secondary"
                          >
                            {food.displayName}
                            {food.brand ? ` (${food.brand})` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {selectedFood && (
                    <div className="grid gap-2 rounded border border-secondary p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{selectedFood.displayName}</span>
                        <button type="button" onClick={clearSelectedFood} className="cursor-pointer text-sm underline">
                          Change
                        </button>
                      </div>

                      <label htmlFor="google-health-meal-type" className="sr-only">Meal</label>
                      <select
                        id="google-health-meal-type"
                        value={mealType}
                        onChange={(e) => setMealType(e.target.value)}
                        className="rounded border-2 border-secondary bg-black p-2 text-sm text-white"
                      >
                        {MEAL_TYPES.map((mt) => (
                          <option key={mt.value} value={mt.value} className="bg-black text-white">
                            {mt.label}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="google-health-date" className="sr-only">Date</label>
                      <input
                        id="google-health-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="rounded border-2 border-secondary bg-black p-2 text-sm text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              {googleHealthError && (
                <p role="alert" className="text-sm text-red-600">
                  {googleHealthError}
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
