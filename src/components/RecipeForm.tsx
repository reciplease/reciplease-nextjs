import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useMeasures } from '@/lib/measures';

type IngredientRowState = {
  key: number;
  name: string;
  measureId: MeasureId;
  amount: string;
  originalUnit?: string;
};

export type RecipeFormIngredient = {
  name: string;
  measureId: MeasureId;
  amount: number;
  originalUnit?: string;
};

export type RecipeFormValues = {
  name: string;
  description: string | null;
  steps: string[];
  ingredients: RecipeFormIngredient[];
  isPublic: boolean;
  sourceUrl?: string | null;
};

export type RecipeFormInitial = {
  name: string;
  description: string | null;
  steps: string[];
  ingredients: RecipeFormIngredient[];
  isPublic: boolean;
  sourceUrl?: string | null;
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
  originalUnit,
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
  originalUnit?: string;
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
    <li className="grid grid-cols-[1fr_8rem_7rem_2rem] gap-x-2 gap-y-0.5">
      <input
        type="text"
        aria-label={`Ingredient ${number}`}
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Add an ingredient…"
        className="p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
      />
      <select
        aria-label={`Measure ${number}`}
        value={effectiveMeasureId}
        onChange={(e) => onMeasure(e.target.value)}
        className="w-full p-2 text-base border border-[#ccc] rounded"
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
        className="w-full p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
      />
      <span className="flex items-center justify-center">
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
      {/* Row 2: hint beneath the measure column only */}
      <span className="col-start-2 h-4 text-xs text-[#888] px-1">
        {originalUnit && effectiveMeasureId === 'item' ? `was: ${originalUnit}` : ''}
      </span>
    </li>
  );
}

function initialRows(ingredients: RecipeFormIngredient[]): IngredientRowState[] {
  const rows = ingredients.map((ingredient, index) => ({
    key: index,
    name: ingredient.name,
    measureId: ingredient.measureId,
    amount: String(ingredient.amount),
    originalUnit: ingredient.originalUnit,
  }));
  rows.push({ key: rows.length, name: '', measureId: '', amount: '', originalUnit: undefined });
  return rows;
}

interface Props {
  initial?: RecipeFormInitial;
  submitLabel: string;
  onSubmit: (values: RecipeFormValues) => Promise<string | void>;
  onDelete?: () => void;
}

export default function RecipeForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  // Private by default for new recipes.
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);

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

  const measures = useMeasures();

  function setRowName(key: number, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) => (r.key === key ? { ...r, name: value } : r));
      const last = updated[updated.length - 1];
      // Naming the last row reveals a fresh empty row.
      if (last.key === key && value.trim()) {
        updated.push({ key: nextKey.current++, name: '', measureId: '', amount: '' });
      }
      return updated;
    });
  }

  function setRowMeasure(key: number, measureId: MeasureId) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, measureId } : r)));
  }

  function setAmount(key: number, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount: value } : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => {
      const updated = prev.filter((r) => r.key !== key);
      // Always keep at least one empty trailing row.
      if (!updated.length || updated[updated.length - 1].name.trim()) {
        updated.push({ key: nextKey.current++, name: '', measureId: '', amount: '' });
      }
      return updated;
    });
  }

  const [error, handleSubmit, submitting] = useActionState(async (): Promise<string | null> => {
    const filledRows = rows.filter((r) => r.name.trim());
    const invalidAmounts = filledRows.filter((r) => !r.amount || parseFloat(r.amount) <= 0);
    if (invalidAmounts.length) {
      return 'Enter an amount greater than 0 for each ingredient.';
    }

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
        isPublic,
        sourceUrl: initial?.sourceUrl ?? null,
      });

      return errorMessage ?? null;
    } catch {
      return 'An unexpected error occurred.';
    }
  }, null);

  return (
    <form action={handleSubmit} className="grid gap-6">
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

        {initial?.sourceUrl && (
          <a
            href={initial.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#666] hover:underline truncate"
          >
            Source: {initial.sourceUrl}
          </a>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public (visible to everyone, not just your house)
        </label>
      </div>

      {/* Ingredients */}
      <div>
        <h4 className="mb-2">Ingredients</h4>
        <ul className="grid gap-2 list-none">
          {rows.map((row, index) => (
            <IngredientRow
              key={row.key}
              index={index}
              name={row.name}
              measureId={row.measureId}
              amount={row.amount}
              originalUnit={row.originalUnit}
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
      <div>
        <h4 className="mb-2">Method</h4>
        <ol className="grid gap-2 list-none">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-3 text-sm text-[#666] shrink-0">{index + 1}.</span>
              <textarea
                aria-label={`Step ${index + 1}`}
                value={step}
                onChange={(e) => {
                  const updated = [...steps];
                  updated[index] = e.target.value;
                  // Typing in the last step spawns a new empty one.
                  if (index === steps.length - 1 && e.target.value.trim()) {
                    updated.push('');
                  }
                  setSteps(updated);
                }}
                placeholder="Describe this step"
                rows={2}
                className="flex-1 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
              />
              <button
                type="button"
                onClick={() => {
                  const updated = steps.filter((_, i) => i !== index);
                  if (!updated.length || updated[updated.length - 1].trim()) updated.push('');
                  setSteps(updated);
                }}
                aria-label={`Remove step ${index + 1}`}
                className="mt-1 shrink-0"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      </div>

      {error && <p role="alert" className="text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {onDelete ? (
          <button
            type="submit"
            formAction={onDelete}
            disabled={submitting}
            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
          >
            Delete recipe
          </button>
        ) : <span />}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
