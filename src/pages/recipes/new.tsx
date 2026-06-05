import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';

const fetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((res) => res.json());

type IngredientRowState = {
  key: number;
  selected: Ingredient | null;
  amount: string;
};

/**
 * One auto-growing ingredient row: a search-as-you-type picker (with an inline
 * "create new ingredient" fallback) plus an amount. The parent appends a fresh
 * empty row as soon as this one gets an ingredient, so the user never clicks
 * "add" — they just keep typing.
 */
function IngredientRow({
  index,
  selected,
  amount,
  measures,
  onSelect,
  onAmount,
  onRemove,
  removable,
}: {
  index: number;
  selected: Ingredient | null;
  amount: string;
  measures: Measure[] | undefined;
  onSelect: (ingredient: Ingredient | null) => void;
  onAmount: (amount: string) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const [query, setQuery] = useState(selected?.name ?? '');
  const [creating, setCreating] = useState(false);
  const [newMeasureId, setNewMeasureId] = useState<MeasureId>('');
  const [creatingError, setCreatingError] = useState<string | null>(null);

  const { data: results } = useSWR<Ingredient[]>(
    query.trim() && !selected
      ? `/api/ingredients/search?q=${encodeURIComponent(query.trim())}`
      : null,
    fetcher,
  );
  const effectiveMeasureId = newMeasureId || measures?.[0]?.measureId || '';
  const number = index + 1;

  function pick(ingredient: Ingredient) {
    setQuery(ingredient.name);
    setCreating(false);
    setCreatingError(null);
    onSelect(ingredient);
  }

  async function createIngredient() {
    setCreatingError(null);
    const trimmed = query.trim();
    if (!trimmed || !effectiveMeasureId) return;
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, measureId: effectiveMeasureId }),
      });
      if (!res.ok) {
        setCreatingError('Could not create ingredient. Please try again.');
        return;
      }
      const ingredient: Ingredient = await res.json();
      pick(ingredient);
    } catch {
      setCreatingError('An unexpected error occurred.');
    }
  }

  return (
    <li className="grid gap-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <input
            type="text"
            aria-label={`Ingredient ${number}`}
            value={selected ? selected.name : query}
            onChange={(e) => {
              if (selected) onSelect(null);
              setCreating(false);
              setQuery(e.target.value);
            }}
            placeholder="Add an ingredient…"
            className="w-full p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
          />
          {!selected && !creating && query.trim() && (
            <ul className="absolute z-10 mt-1 w-full list-none p-0 m-0 max-h-48 overflow-auto border border-[#ccc] rounded bg-white shadow">
              {(results ?? []).map((ing) => (
                <li key={ing.uuid}>
                  <button
                    type="button"
                    onClick={() => pick(ing)}
                    className="block w-full text-left px-3 py-2 hover:bg-[#f0f0f0]"
                  >
                    {ing.name}{' '}
                    <span className="text-sm text-[#666]">({ing.measure.plural})</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    setCreatingError(null);
                  }}
                  className="block w-full text-left px-3 py-2 text-emerald-700 hover:bg-[#f0f0f0]"
                >
                  + Create “{query.trim()}”
                </button>
              </li>
            </ul>
          )}
        </div>
        <input
          type="number"
          min="0"
          step="any"
          aria-label={`Amount ${number}`}
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder="Amount"
          className="w-28 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
        />
        {/* Reserve the column so the search box keeps a constant width. */}
        <span className="w-4 mt-1 shrink-0">
          {removable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ingredient ${number}`}
            >
              ×
            </button>
          )}
        </span>
      </div>

      {creating && (
        <div className="flex flex-wrap items-center gap-2 border border-[#eee] rounded p-3">
          <span>
            New ingredient: <strong>{query.trim()}</strong>
          </span>
          <label htmlFor={`new-measure-${number}`} className="text-sm text-[#666]">
            Measure
          </label>
          <select
            id={`new-measure-${number}`}
            aria-label="Measure"
            value={effectiveMeasureId}
            onChange={(e) => setNewMeasureId(e.target.value)}
            className="p-2 text-base border border-[#ccc] rounded"
          >
            {(measures ?? []).map((m) => (
              <option key={m.measureId} value={m.measureId}>
                {m.plural}
              </option>
            ))}
          </select>
          <button type="button" onClick={createIngredient} disabled={!effectiveMeasureId}>
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
          {creatingError && (
            <p role="alert" className="text-red-600 w-full">
              {creatingError}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function NewRecipe() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Both lists keep a single trailing empty entry; filling it spawns the next.
  const [steps, setSteps] = useState<string[]>(['']);
  const [rows, setRows] = useState<IngredientRowState[]>([
    { key: 0, selected: null, amount: '' },
  ]);
  const nextKey = useRef(1);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: measures } = useSWR<Measure[]>('/api/measures', fetcher);

  function selectIngredient(key: number, ingredient: Ingredient | null) {
    setRows((prev) => {
      const updated = prev.map((r) => (r.key === key ? { ...r, selected: ingredient } : r));
      const last = updated[updated.length - 1];
      // Picking an ingredient in the last row reveals a fresh empty row.
      if (ingredient && last.key === key) {
        updated.push({ key: nextKey.current++, selected: null, amount: '' });
      }
      return updated;
    });
  }

  function setAmount(key: number, amount: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => {
      const updated = prev.filter((r) => r.key !== key);
      if (updated.length === 0 || updated[updated.length - 1].selected) {
        updated.push({ key: nextKey.current++, selected: null, amount: '' });
      }
      return updated;
    });
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => {
      const updated = prev.map((s, i) => (i === index ? value : s));
      // Typing into the trailing empty step reveals the next one.
      if (index === updated.length - 1 && value.trim() !== '') {
        updated.push('');
      }
      return updated;
    });
  }

  function removeStep(index: number) {
    setSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.length ? updated : [''];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const filledRows = rows.filter((r) => r.selected);
    if (filledRows.some((r) => Number.isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0)) {
      setError('Enter an amount greater than 0 for each ingredient.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
      const createRes = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          steps: cleanedSteps,
        }),
      });
      if (!createRes.ok) {
        setError('Failed to create recipe. Please try again.');
        return;
      }
      const recipe: Recipe = await createRes.json();

      // Ingredients attach one-by-one on the backend.
      for (const row of filledRows) {
        const res = await fetch(`/api/recipes/${recipe.recipeId}/ingredients`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredientId: row.selected!.uuid,
            amount: parseFloat(row.amount),
          }),
        });
        if (!res.ok) {
          setError('Recipe saved, but some ingredients could not be added.');
          return;
        }
      }

      router.push(`/recipes/${recipe.recipeShortId}`);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Metadata title="New Recipe" description="Create a new recipe" />

      <section>
        <form onSubmit={handleSubmit} className="grid gap-y-6">
          {/* Basics */}
          <div className="grid gap-2">
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-label="Recipe title"
              placeholder="Recipe title..."
              className="text-xl font-semibold p-2 border-b border-[#ccc] focus:outline-none placeholder:text-[#999] placeholder:font-semibold"
            />

            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Description"
              placeholder="Add a description..."
              rows={2}
              className="p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
            />
          </div>

          {/* Ingredients */}
          <div className="grid gap-2">
            <h4 className="font-medium">Ingredients</h4>
            <ul className="list-none p-0 m-0 grid gap-2">
              {rows.map((row, index) => (
                <IngredientRow
                  key={row.key}
                  index={index}
                  selected={row.selected}
                  amount={row.amount}
                  measures={measures}
                  onSelect={(ing) => selectIngredient(row.key, ing)}
                  onAmount={(amt) => setAmount(row.key, amt)}
                  onRemove={() => removeRow(row.key)}
                  removable={rows.length > 1 && index < rows.length - 1}
                />
              ))}
            </ul>
          </div>

          {/* Method */}
          <div className="grid gap-2">
            <h4 className="font-medium">Method</h4>
            <ol className="list-none p-0 m-0 grid gap-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 text-right text-[#666]">{i + 1}.</span>
                  <textarea
                    value={step}
                    aria-label={`Step ${i + 1}`}
                    onChange={(e) => updateStep(i, e.target.value)}
                    rows={2}
                    placeholder="Describe this step"
                    className="flex-1 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
                  />
                  {/* Reserve the column even on the trailing row so every
                      textarea is the same width whether or not the × shows. */}
                  <span className="w-4 mt-1 shrink-0">
                    {i < steps.length - 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        aria-label={`Remove step ${i + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {error && <p role="alert" className="text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving…' : 'Save recipe'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
