import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { apiFetch, useActiveHouse } from '@/lib/houses';
import { useMeasures } from '@/lib/measures';
import { toRecipe, type BackendRecipe } from '@/lib/recipes';

type RowState = {
  key: number;
  name: string;
  measureId: MeasureId;
  amount: string;
  pantryItemId?: string;
  pantryItemName?: string;
  allocationAmount?: string;
};

export type PlannedMealFormItem = {
  name: string;
  measureId: MeasureId;
  amount: number;
  pantryItemId?: string;
  allocationAmount?: number;
};

export type PlannedMealFormValues = {
  name: string;
  date: string;
  recipeId: string;
  items: PlannedMealFormItem[];
};

export type PlannedMealFormInitial = PlannedMealFormValues;

const recipesFetcher = async (url: string): Promise<Recipe[]> => {
  const res = await apiFetch(url);
  if (!res.ok) return [];
  const backendRecipes: BackendRecipe[] = await res.json();
  return backendRecipes.map(toRecipe);
};

const pantryFetcher = async (url: string): Promise<PantryItem[]> => {
  const res = await apiFetch(url);
  if (!res.ok) return [];
  return res.json();
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function itemsToRows(items: PlannedMealFormItem[]): RowState[] {
  return items.map((item, index) => ({
    key: index,
    name: item.name,
    measureId: item.measureId,
    amount: String(item.amount),
    pantryItemId: item.pantryItemId,
    allocationAmount: item.allocationAmount !== undefined ? String(item.allocationAmount) : undefined,
  }));
}

/**
 * One planned-ingredient row. Rows can originate from picking an existing
 * pantry item (fully allocated), typing a freeform ingredient to buy (no
 * allocation), or a recipe's own ingredient list (partially allocated by
 * attaching stock afterwards) — all three end up as the same row shape, since
 * a PlannedIngredient doesn't care where it came from.
 */
function IngredientRow({
  row,
  measures,
  pantryItems,
  onChange,
  onRemove,
}: {
  row: RowState;
  measures: Measure[];
  pantryItems: PantryItem[];
  onChange: (row: RowState) => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_6rem_2rem] gap-x-2 gap-y-1 border-b border-[#eee] pb-2">
      <input
        type="text"
        aria-label="Ingredient name"
        value={row.name}
        onChange={(e) => onChange({ ...row, name: e.target.value })}
        placeholder="Ingredient name…"
        className="col-span-2 sm:col-span-1 min-w-0 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
      />
      <select
        aria-label="Measure"
        value={row.measureId || measures[0]?.measureId || ''}
        onChange={(e) => onChange({ ...row, measureId: e.target.value as MeasureId })}
        className="w-full min-w-0 p-2 text-base border border-[#ccc] rounded"
      >
        {measures.map((m) => (
          <option key={m.measureId} value={m.measureId}>{m.plural}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          aria-label="Amount"
          value={row.amount}
          onChange={(e) => onChange({ ...row, amount: e.target.value })}
          placeholder="Amount"
          className="w-full min-w-0 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
        />
        <button type="button" onClick={onRemove} aria-label="Remove ingredient" className="shrink-0">×</button>
      </div>

      <div className="col-span-2 sm:col-span-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`allocate-${row.key}`} className="text-[#666] shrink-0">From stock:</label>
        <select
          id={`allocate-${row.key}`}
          value={row.pantryItemId ?? ''}
          onChange={(e) => {
            const item = pantryItems.find((i) => i.uuid === e.target.value);
            if (!item) {
              onChange({ ...row, pantryItemId: undefined, pantryItemName: undefined, allocationAmount: undefined });
              return;
            }
            onChange({
              ...row,
              pantryItemId: item.uuid,
              pantryItemName: item.name,
              allocationAmount: String(Math.min(item.remaining, parseFloat(row.amount) || item.remaining)),
            });
          }}
          className="flex-1 min-w-0 p-1.5 border border-[#ccc] rounded"
        >
          <option value="">— none, add to shopping list —</option>
          {pantryItems.map((item) => (
            <option key={item.uuid} value={item.uuid}>
              {item.brand ? `${item.brand} ` : ''}{item.name} ({item.remaining} {item.measure} left)
            </option>
          ))}
        </select>
        {row.pantryItemId && (
          <input
            type="number"
            min="0"
            step="any"
            aria-label="Amount used from stock"
            value={row.allocationAmount ?? ''}
            onChange={(e) => onChange({ ...row, allocationAmount: e.target.value })}
            className="w-24 min-w-0 p-1.5 border border-[#ccc] rounded"
          />
        )}
      </div>
    </li>
  );
}

interface Props {
  initial?: PlannedMealFormInitial;
  submitLabel: string;
  onSubmit: (values: PlannedMealFormValues) => Promise<string | void>;
  onDelete?: () => void;
}

export default function PlannedMealForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const router = useRouter();
  const activeHouse = useActiveHouse();
  const measures = useMeasures();
  const { data: recipes } = useSWR(activeHouse ? ['/api/recipes', activeHouse.id] : null, () => recipesFetcher('/api/recipes'));
  const { data: pantryItems } = useSWR(activeHouse ? ['/api/pantry', activeHouse.id] : null, () => pantryFetcher('/api/pantry'));

  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? toDateInputValue(new Date()));
  const [recipeId, setRecipeId] = useState(initial?.recipeId ?? '');
  const [rows, setRows] = useState<RowState[]>(() => (initial?.items.length ? itemsToRows(initial.items) : []));
  const nextKey = useRef(rows.length);

  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientMeasure, setNewIngredientMeasure] = useState<MeasureId>('' as MeasureId);
  const [newIngredientAmount, setNewIngredientAmount] = useState('');

  function updateRow(key: number, updated: RowState) {
    setRows((prev) => prev.map((r) => (r.key === key ? updated : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function loadIngredientsFromRecipe() {
    const recipe = recipes?.find((r) => r.recipeId === recipeId);
    if (!recipe) return;
    const existingNames = new Set(rows.map((r) => r.name.toLowerCase()));
    const newRows: RowState[] = recipe.ingredients
      .filter((ingredient) => !existingNames.has(ingredient.name.toLowerCase()))
      .map((ingredient) => ({
        key: nextKey.current++,
        name: ingredient.name,
        measureId: ingredient.measure,
        amount: String(ingredient.amount),
      }));
    setRows((prev) => [...prev, ...newRows]);
  }

  function addIngredientToBuy() {
    if (!newIngredientName.trim() || !newIngredientAmount) return;
    setRows((prev) => [...prev, {
      key: nextKey.current++,
      name: newIngredientName.trim(),
      measureId: newIngredientMeasure || measures[0]?.measureId || ('' as MeasureId),
      amount: newIngredientAmount,
    }]);
    setNewIngredientName('');
    setNewIngredientAmount('');
  }

  const [error, handleSubmit, submitting] = useActionState(async (): Promise<string | null> => {
    const filledRows = rows.filter((r) => r.name.trim());
    if (filledRows.some((r) => !r.amount || parseFloat(r.amount) <= 0)) {
      return 'Enter an amount greater than 0 for each ingredient.';
    }

    try {
      const items: PlannedMealFormItem[] = filledRows.map((row) => ({
        name: row.name.trim(),
        measureId: (row.measureId || measures[0]?.measureId || '') as MeasureId,
        amount: parseFloat(row.amount),
        pantryItemId: row.pantryItemId,
        allocationAmount: row.pantryItemId ? parseFloat(row.allocationAmount || row.amount) : undefined,
      }));

      const errorMessage = await onSubmit({
        name: name.trim(),
        date,
        recipeId,
        items,
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
          type="text"
          aria-label="Meal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Meal name (e.g. Dinner)…"
          className="text-lg font-medium p-2 border-b border-[#ccc] focus:outline-none placeholder:text-[#999]"
        />
        <label className="grid gap-1 text-sm">
          Date
          <input
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="p-2 text-base border border-[#ccc] rounded w-fit"
          />
        </label>
      </div>

      <div className="grid gap-2">
        <h4>Recipe (optional)</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            aria-label="Recipe"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="w-full sm:flex-1 min-w-0 p-2 text-base border border-[#ccc] rounded"
          >
            <option value="">— no recipe —</option>
            {(recipes ?? []).map((recipe) => (
              <option key={recipe.recipeId} value={recipe.recipeId}>{recipe.name}</option>
            ))}
          </select>
          <button type="button" onClick={loadIngredientsFromRecipe} disabled={!recipeId} className="shrink-0">
            Load ingredients
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <h4>Add an ingredient to buy</h4>
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_6rem_5rem] gap-2">
          <input
            type="text"
            aria-label="New ingredient name"
            value={newIngredientName}
            onChange={(e) => setNewIngredientName(e.target.value)}
            placeholder="Ingredient name…"
            className="col-span-2 sm:col-span-1 min-w-0 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
          />
          <select
            aria-label="New ingredient measure"
            value={newIngredientMeasure || measures[0]?.measureId || ''}
            onChange={(e) => setNewIngredientMeasure(e.target.value as MeasureId)}
            className="min-w-0 p-2 text-base border border-[#ccc] rounded"
          >
            {measures.map((m) => (
              <option key={m.measureId} value={m.measureId}>{m.plural}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            aria-label="New ingredient amount"
            value={newIngredientAmount}
            onChange={(e) => setNewIngredientAmount(e.target.value)}
            placeholder="Amount"
            className="min-w-0 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
          />
          <button type="button" onClick={addIngredientToBuy} className="col-span-2 sm:col-span-1">Add</button>
        </div>
      </div>

      <div>
        <h4 className="mb-2">Ingredients ({rows.length})</h4>
        {rows.length === 0 ? (
          <p className="text-sm text-[#666]">No ingredients yet — load them from a recipe or add one above.</p>
        ) : (
          <ul className="grid gap-2 list-none">
            {rows.map((row) => (
              <IngredientRow
                key={row.key}
                row={row}
                measures={measures}
                pantryItems={pantryItems ?? []}
                onChange={(updated) => updateRow(row.key, updated)}
                onRemove={() => removeRow(row.key)}
              />
            ))}
          </ul>
        )}
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
            Delete meal
          </button>
        ) : <span />}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} disabled={submitting}>Cancel</button>
          <button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
