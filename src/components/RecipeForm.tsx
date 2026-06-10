import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';

const fetcher = <T,>(url: string): Promise<T> =>
  fetch(url).then((res) => res.json());

type IngredientRowState = {
  key: number;
  name: string;
  measureId: MeasureId;
  amount: string;
};

export type RecipeFormIngredient = {
  name: string;
  measureId: MeasureId;
  amount: number;
};

export type RecipeFormValues = {
  name: string;
  description: string | null;
  steps: string[];
  ingredients: RecipeFormIngredient[];
};

export type RecipeFormInitial = {
  name: string;
  description: string | null;
  steps: string[];
  ingredients: RecipeFormIngredient[];
};

/**
 * One auto-growing ingredient row: a free-text name, a measure, and an amount.
 * Recipe ingredients are self-contained (not tied to any catalog or inventory),
 * so the name is just typed in. The parent appends a fresh empty row as soon as
 * this one gets a name, so the user never clicks "add".
 */
function IngredientRow({
  index,
  name,
  measureId,
  amount,
  measures,
  onName,
  onMeasure,
  onAmount,
  onRemove,
  removable,
}: {
  index: number;
  name: string;
  measureId: MeasureId;
  amount: string;
  measures: Measure[] | undefined;
  onName: (name: string) => void;
  onMeasure: (measureId: MeasureId) => void;
  onAmount: (amount: string) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const number = index + 1;
  const effectiveMeasureId = measureId || measures?.[0]?.measureId || '';

  return (
    <li className="grid gap-2">
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="text"
          aria-label={`Ingredient ${number}`}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Add an ingredient…"
          className="flex-1 min-w-[12rem] p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
        />
        <select
          aria-label={`Measure ${number}`}
          value={effectiveMeasureId}
          onChange={(e) => onMeasure(e.target.value)}
          className="w-32 p-2 text-base border border-[#ccc] rounded"
        >
          {(measures ?? []).map((m) => (
            <option key={m.measureId} value={m.measureId}>
              {m.plural}
            </option>
          ))}
        </select>
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
        {/* Reserve the column so the row keeps a constant width. */}
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
    </li>
  );
}

function initialRows(ingredients: RecipeFormIngredient[]): IngredientRowState[] {
  const rows = ingredients.map((ingredient, index) => ({
    key: index,
    name: ingredient.name,
    measureId: ingredient.measureId,
    amount: String(ingredient.amount),
  }));
  rows.push({ key: rows.length, name: '', measureId: '', amount: '' });
  return rows;
}

interface Props {
  initial?: RecipeFormInitial;
  submitLabel: string;
  onSubmit: (values: RecipeFormValues) => Promise<string | void>;
}

export default function RecipeForm({ initial, submitLabel, onSubmit }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  // Both lists keep a single trailing empty entry; filling it spawns the next.
  const [steps, setSteps] = useState<string[]>(
    initial?.steps.length ? [...initial.steps, ''] : [''],
  );
  const [rows, setRows] = useState<IngredientRowState[]>(() =>
    initial?.ingredients.length
      ? initialRows(initial.ingredients)
      : [{ key: 0, name: '', measureId: '', amount: '' }],
  );
  const nextKey = useRef(rows.length);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: measures } = useSWR<Measure[]>('/api/measures', fetcher);

  function setRowName(key: number, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) => (r.key === key ? { ...r, name: value } : r));
      const last = updated[updated.length - 1];
      // Naming the last row reveals a fresh empty row.
      if (value.trim() && last.key === key) {
        updated.push({ key: nextKey.current++, name: '', measureId: '', amount: '' });
      }
      return updated;
    });
  }

  function setRowMeasure(key: number, measureId: MeasureId) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, measureId } : r)));
  }

  function setAmount(key: number, amount: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => {
      const updated = prev.filter((r) => r.key !== key);
      if (updated.length === 0 || updated[updated.length - 1].name.trim()) {
        updated.push({ key: nextKey.current++, name: '', measureId: '', amount: '' });
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

    const filledRows = rows.filter((r) => r.name.trim());
    if (filledRows.some((r) => Number.isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0)) {
      setError('Enter an amount greater than 0 for each ingredient.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
      const ingredients: RecipeFormIngredient[] = filledRows.map((row) => ({
        name: row.name.trim(),
        measureId: (row.measureId || measures?.[0]?.measureId || '') as MeasureId,
        amount: parseFloat(row.amount),
      }));

      const errorMessage = await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        steps: cleanedSteps,
        ingredients,
      });

      if (errorMessage) {
        setError(errorMessage);
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
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
              name={row.name}
              measureId={row.measureId}
              amount={row.amount}
              measures={measures}
              onName={(value) => setRowName(row.key, value)}
              onMeasure={(m) => setRowMeasure(row.key, m)}
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
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
