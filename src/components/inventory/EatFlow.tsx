import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/houses';
import { useGoogleHealthConnection, MEAL_TYPES } from '@/lib/googleHealth';
import { searchFood, searchFoodByBarcode, type FoodSearchResult } from '@/lib/foodSearch';
import BarcodeScanner from '@/components/scanner/BarcodeScanner';

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
//
// Food search merges two sources (see /api/food/search): the user's own
// Google Health history (an "identified food" match — Google fills in
// accurate nutrients itself) and Open Food Facts (an "anonymous" match —
// nutrients travel along with the log request instead). Search works even
// when Google Health isn't linked; only the history group is then empty.
export default function EatFlow({ uuid, item, onSaved }: EatFlowProps) {
  const { data: connection } = useGoogleHealthConnection();
  const googleHealthConnected = connection?.connected ?? false;

  const [open, setOpen] = useState(false);
  const [amountEaten, setAmountEaten] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleHealthError, setGoogleHealthError] = useState<string | null>(null);

  const [query, setQuery] = useState(item.name);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [mealType, setMealType] = useState<string>(MEAL_TYPES[0]?.value ?? 'SNACK');
  const [date, setDate] = useState(today());
  const [scannerOpen, setScannerOpen] = useState(false);

  function openPanel() {
    setError(null);
    setGoogleHealthError(null);
    setAmountEaten('');
    setQuery(item.name);
    setResults([]);
    setSelectedFood(null);
    setMealType(MEAL_TYPES[0]?.value ?? 'SNACK');
    setDate(today());
    setScannerOpen(false);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
  }

  // Debounced food search, only while the panel is open — no point querying
  // otherwise. Doesn't reset `results` itself when those conditions aren't
  // met (that would be a synchronous setState in an effect body, triggering
  // an extra cascading render) — searchable below instead derives whether to
  // show stale results from the same conditions.
  useEffect(() => {
    if (!open || !query.trim()) return;
    const handle = setTimeout(() => {
      searchFood(query).then(setResults);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, query]);

  const searchable = open && query.trim().length > 0;
  const visibleResults = searchable ? results : [];
  const historyResults = visibleResults.filter((r) => r.source === 'HISTORY');
  const catalogResults = visibleResults.filter((r) => r.source === 'CATALOG');

  function selectFood(food: FoodSearchResult) {
    setSelectedFood(food);
    setResults([]);
  }

  function clearSelectedFood() {
    setSelectedFood(null);
  }

  async function onBarcodeDetected(barcode: string) {
    setScannerOpen(false);
    const found = await searchFoodByBarcode(barcode);
    if (found) {
      selectFood(found);
    }
  }

  /** Logs to Google Health if a food was matched. Returns false only when a log was attempted
   * and failed — the caller uses that to decide whether to leave the panel open with the error
   * visible. Skipped entirely (returns true) when Google Health isn't linked, since there's
   * nowhere to log to. */
  async function maybeLogGoogleHealth(amount: number): Promise<boolean> {
    if (!selectedFood || !googleHealthConnected || !mealType || !date) return true;
    try {
      const res = await apiFetch('/api/google-health/foods/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodId: selectedFood.identifiedFoodId ?? undefined,
          foodDisplayName: selectedFood.displayName,
          mealType,
          date,
          amount,
          nutrients: selectedFood.identifiedFoodId ? undefined : (selectedFood.nutrients ?? undefined),
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

              <div className="grid gap-2 border-t border-secondary pt-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="food-search" className="text-sm">
                    Match to a food (optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setScannerOpen((prev) => !prev)}
                    className="cursor-pointer text-sm underline"
                  >
                    {scannerOpen ? 'Close scanner' : 'Scan barcode'}
                  </button>
                </div>

                {scannerOpen && (
                  <div className="h-48 w-full overflow-hidden rounded border border-secondary">
                    <BarcodeScanner active={scannerOpen} onDetected={onBarcodeDetected} />
                  </div>
                )}

                <input
                  id="food-search"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    clearSelectedFood();
                  }}
                  className="w-full p-2 text-base"
                />

                {!selectedFood && (historyResults.length > 0 || catalogResults.length > 0) && (
                  <div className="max-h-48 overflow-y-auto rounded border border-secondary">
                    {historyResults.length > 0 && (
                      <>
                        <p className="px-2 pt-1 text-xs uppercase text-secondary">Recently eaten</p>
                        <ul>
                          {historyResults.map((food, i) => (
                            <li key={`history-${food.identifiedFoodId ?? food.displayName}-${i}`}>
                              <button
                                type="button"
                                onClick={() => selectFood(food)}
                                className="w-full cursor-pointer px-2 py-1 text-left text-sm hover:bg-secondary"
                              >
                                {food.displayName}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {catalogResults.length > 0 && (
                      <>
                        <p className="px-2 pt-1 text-xs uppercase text-secondary">Search results</p>
                        <ul>
                          {catalogResults.map((food, i) => (
                            <li key={`catalog-${food.displayName}-${i}`}>
                              <button
                                type="button"
                                onClick={() => selectFood(food)}
                                className="w-full cursor-pointer px-2 py-1 text-left text-sm hover:bg-secondary"
                              >
                                {food.displayName}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {selectedFood && (
                  <div className="grid gap-2 rounded border border-secondary p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{selectedFood.displayName}</span>
                      <button type="button" onClick={clearSelectedFood} className="cursor-pointer text-sm underline">
                        Change
                      </button>
                    </div>

                    {googleHealthConnected ? (
                      <>
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
                      </>
                    ) : (
                      <p className="text-xs text-secondary">Link Google Health in settings to log this to your food diary.</p>
                    )}
                  </div>
                )}
              </div>

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
