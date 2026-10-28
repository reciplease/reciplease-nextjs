import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import RecipeTableEditor from '@/components/RecipeTableEditor';
import { ingredientRowText } from '@/lib/ingredient-row-text';
import { useMeasures } from '@/lib/measures';
import {
  createRecipeBodyNameMax,
  createRecipeBodySourceUrlRegExp,
} from '@/types/generated/zod';

const recipeFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a recipe name.').max(
    createRecipeBodyNameMax,
    `Recipe name must be at most ${createRecipeBodyNameMax} characters.`,
  ),
  sourceUrl: z.string().regex(createRecipeBodySourceUrlRegExp, 'Enter a valid URL.').nullish(),
  prepTimeMinutes: z.number().int('Prep time must be a whole number of minutes.').min(0, 'Prep time cannot be negative.').nullable(),
  cookTimeMinutes: z.number().int('Cook time must be a whole number of minutes.').min(0, 'Cook time cannot be negative.').nullable(),
  servings: z.number().int('Servings must be a whole number.').min(1, 'Servings must be at least 1.').nullable(),
  ingredients: z.array(z.object({
    name: z.string().trim().min(1),
    measureId: z.string(),
    amount: z.coerce.number().gt(0, 'Enter an amount greater than 0 for each ingredient.'),
  })),
});

function toOptionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

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
  method: RecipeMethod;
  ingredients: RecipeFormIngredient[];
  isPublic: boolean;
  sourceUrl?: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number | null;
};

export type RecipeFormInitial = {
  name: string;
  description: string | null;
  method: RecipeMethod;
  ingredients: RecipeFormIngredient[];
  isPublic: boolean;
  sourceUrl?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
};

/**
 * One auto-growing ingredient row: a free-text name, a measure, and an amount.
 * Recipe ingredients are self-contained (not tied to any catalog or pantry),
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
        className="field min-w-0"
      />
      <select
        aria-label={`Measure ${number}`}
        value={effectiveMeasureId}
        onChange={(e) => onMeasure(e.target.value)}
        className="field w-full min-w-0"
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
        className="field w-full min-w-0"
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
  const [prepTime, setPrepTime] = useState(initial?.prepTimeMinutes?.toString() ?? '');
  const [cookTime, setCookTime] = useState(initial?.cookTimeMinutes?.toString() ?? '');
  const [servings, setServings] = useState(initial?.servings?.toString() ?? '');

  const initialMethod = initial?.method;
  const [methodMode, setMethodMode] = useState<'list' | 'table'>(
    initialMethod && 'cells' in initialMethod ? 'table' : 'list',
  );
  const [steps, setSteps] = useState<string[]>(
    initialMethod && 'steps' in initialMethod && initialMethod.steps.length
      ? [...initialMethod.steps, '']
      : [''],
  );
  const [cells, setCells] = useState<TableCell[]>(
    initialMethod && 'cells' in initialMethod ? initialMethod.cells : [],
  );
  const [rows, setRows] = useState<IngredientRowState[]>(() =>
    initial?.ingredients.length
      ? initialRows(initial.ingredients)
      : [{ key: 0, name: '', measureId: '', amount: '' }],
  );
  const nextKey = useRef(rows.length);

  const measures = useMeasures();

  const tableIngredients = rows
    .filter((row) => row.name.trim() && Number(row.amount) > 0)
    .map((row) =>
      ingredientRowText(
        {
          name: row.name,
          measureId: row.measureId || measures[0]?.measureId || '',
          amount: Number(row.amount),
        },
        measures,
      ),
    );

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
    const method: RecipeMethod =
      methodMode === 'table' ? { cells } : { steps: steps.map((s) => s.trim()).filter(Boolean) };

    const result = recipeFormSchema.safeParse({
      name,
      sourceUrl: initial?.sourceUrl ?? null,
      prepTimeMinutes: toOptionalNumber(prepTime),
      cookTimeMinutes: toOptionalNumber(cookTime),
      servings: toOptionalNumber(servings),
      ingredients: filledRows.map((row) => ({
        name: row.name,
        measureId: row.measureId || measures?.[0]?.measureId || '',
        amount: row.amount,
      })),
    });

    if (!result.success) {
      return result.error.issues[0]?.message ?? 'Invalid input';
    }

    try {
      const ingredients: RecipeFormIngredient[] = result.data.ingredients.map((ingredient) => ({
        name: ingredient.name,
        measureId: ingredient.measureId as MeasureId,
        amount: ingredient.amount,
      }));

      const errorMessage = await onSubmit({
        name: result.data.name,
        description: description.trim() || null,
        method,
        ingredients,
        isPublic,
        sourceUrl: initial?.sourceUrl ?? null,
        prepTimeMinutes: result.data.prepTimeMinutes,
        cookTimeMinutes: result.data.cookTimeMinutes,
        servings: result.data.servings,
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
          className="field"
        />

        <div className="flex flex-wrap gap-4">
          <label className="grid gap-1 text-sm">
            Prep time (minutes)
            <input
              type="number"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className="field w-36"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Cook time (minutes)
            <input
              type="number"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              className="field w-36"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Servings
            <input
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="field w-36"
            />
          </label>
        </div>

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
          Public (visible to everyone, including anonymous visitors)
        </label>
      </div>

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

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4>Method</h4>
          <div className="flex gap-1">
            {(['list', 'table'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={methodMode === mode}
                onClick={() => setMethodMode(mode)}
                className={methodMode === mode ? 'font-semibold underline' : ''}
              >
                {mode === 'list' ? 'List' : 'Table'}
              </button>
            ))}
          </div>
        </div>
        {methodMode === 'table' ? (
          <RecipeTableEditor cells={cells} ingredients={tableIngredients} onChange={setCells} />
        ) : (
          <ol className="grid gap-2 list-none">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-3 text-sm text-[#999] shrink-0">{index + 1}.</span>
                <textarea
                  aria-label={`Step ${index + 1}`}
                  value={step}
                  onChange={(e) => {
                    const updated = [...steps];
                    updated[index] = e.target.value;
                    if (index === steps.length - 1 && e.target.value.trim()) {
                      updated.push('');
                    }
                    setSteps(updated);
                  }}
                  placeholder="Describe this step"
                  rows={2}
                  className="field flex-1 min-w-0"
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
        )}
      </div>

      {error && <p role="alert" className="text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {onDelete ? (
          <button
            type="submit"
            formAction={onDelete}
            disabled={submitting}
            className="btn-danger"
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
