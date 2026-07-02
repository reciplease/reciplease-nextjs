import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiFetch } from '@/lib/houses';
import { useFitbitConnection, MEAL_TYPES, type FitbitFood } from '@/lib/fitbit';

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
// (deleting the item outright if that drops to zero or below, mirroring the
// inline AdjustRemainingForm this replaced), and — when Fitbit is linked —
// optionally logs the same amount to Fitbit's food diary. The FAB and the
// panel it opens live in the same component since neither is useful alone.
export default function EatFlow({ uuid, item, onSaved }: EatFlowProps) {
  const router = useRouter();
  const { data: connection } = useFitbitConnection();
  const fitbitConnected = connection?.connected ?? false;

  const [open, setOpen] = useState(false);
  const [amountEaten, setAmountEaten] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitbitError, setFitbitError] = useState<string | null>(null);

  const [query, setQuery] = useState(item.name);
  const [results, setResults] = useState<FitbitFood[]>([]);
  const [selectedFood, setSelectedFood] = useState<FitbitFood | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [mealTypeId, setMealTypeId] = useState<number>(7);
  const [date, setDate] = useState(today());

  function openPanel() {
    setError(null);
    setFitbitError(null);
    setAmountEaten('');
    setQuery(item.name);
    setResults([]);
    setSelectedFood(null);
    setUnitId(null);
    setMealTypeId(7);
    setDate(today());
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
  }

  // Debounced Fitbit food search, only while the panel is open and Fitbit is
  // linked — no point querying otherwise. Doesn't reset `results` itself when
  // those conditions aren't met (that would be a synchronous setState in an
  // effect body, triggering an extra cascading render) — searchable below
  // instead derives whether to show stale results from the same conditions.
  useEffect(() => {
    if (!open || !fitbitConnected || !query.trim()) return;
    const handle = setTimeout(() => {
      apiFetch(`/api/fitbit/foods/search?query=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((foods: FitbitFood[]) => setResults(Array.isArray(foods) ? foods : []))
        .catch(() => setResults([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, fitbitConnected, query]);

  const searchable = open && fitbitConnected && query.trim().length > 0;
  const visibleResults = searchable ? results : [];

  function selectFood(food: FitbitFood) {
    setSelectedFood(food);
    setUnitId(food.units[0]?.id ?? null);
    setResults([]);
  }

  function clearSelectedFood() {
    setSelectedFood(null);
    setUnitId(null);
  }

  /** Logs to Fitbit if a food was matched and its fields are complete. Returns
   * false only when a log was attempted and failed — the caller uses that to
   * decide whether to leave the panel open with the error visible. */
  async function maybeLogFitbit(amount: number): Promise<boolean> {
    if (!selectedFood || unitId == null || !mealTypeId || !date) return true;
    try {
      const res = await apiFetch('/api/fitbit/foods/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodId: selectedFood.foodId, unitId, amount, mealTypeId, date }),
      });
      if (!res.ok) {
        setFitbitError('Your inventory was updated, but logging to Fitbit failed. Please try again.');
        return false;
      }
      return true;
    } catch {
      setFitbitError('Your inventory was updated, but logging to Fitbit failed. Please try again.');
      return false;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFitbitError(null);
    setSubmitting(true);
    try {
      const eaten = parseFloat(amountEaten);
      const newRemaining = item.remaining - (Number.isFinite(eaten) ? eaten : 0);

      if (newRemaining <= 0) {
        if (!window.confirm(`Mark ${item.name} as fully used? It will be removed from your inventory.`)) {
          return;
        }
        const res = await apiFetch(`/api/inventory/${uuid}`, { method: 'DELETE' });
        if (!res.ok) {
          setError('Failed to remove item. Please try again.');
          return;
        }
        await maybeLogFitbit(eaten);
        router.push('/inventory');
        return;
      }

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
      const fitbitOk = await maybeLogFitbit(eaten);
      if (fitbitOk) {
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

              {fitbitConnected && (
                <div className="grid gap-2 border-t border-secondary pt-3">
                  <label htmlFor="fitbit-search" className="text-sm">
                    Match to a Fitbit food (optional)
                  </label>
                  <input
                    id="fitbit-search"
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
                            {food.name}
                            {food.brand ? ` (${food.brand})` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {selectedFood && (
                    <div className="grid gap-2 rounded border border-secondary p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{selectedFood.name}</span>
                        <button type="button" onClick={clearSelectedFood} className="cursor-pointer text-sm underline">
                          Change
                        </button>
                      </div>

                      <label htmlFor="fitbit-unit" className="sr-only">Unit</label>
                      <select
                        id="fitbit-unit"
                        value={unitId ?? ''}
                        onChange={(e) => setUnitId(Number(e.target.value))}
                        className="rounded border-2 border-secondary bg-black p-2 text-sm text-white"
                      >
                        {selectedFood.units.map((unit) => (
                          <option key={unit.id} value={unit.id} className="bg-black text-white">
                            {unit.name}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="fitbit-meal-type" className="sr-only">Meal</label>
                      <select
                        id="fitbit-meal-type"
                        value={mealTypeId}
                        onChange={(e) => setMealTypeId(Number(e.target.value))}
                        className="rounded border-2 border-secondary bg-black p-2 text-sm text-white"
                      >
                        {MEAL_TYPES.map((mealType) => (
                          <option key={mealType.id} value={mealType.id} className="bg-black text-white">
                            {mealType.label}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="fitbit-date" className="sr-only">Date</label>
                      <input
                        id="fitbit-date"
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
              {fitbitError && (
                <p role="alert" className="text-sm text-red-600">
                  {fitbitError}
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
