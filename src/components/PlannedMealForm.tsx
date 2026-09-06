import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import { useActiveHouse } from '@/lib/houses';
import { useMeasures } from '@/lib/measures';
import { toRecipe, type BackendRecipe } from '@/lib/recipes';
import { PlanMealBody } from '@/types/generated/zod';
import { useFindAllRecipes, useFindAllPantryItems, useSuggestPantryItemsForPlannedMeal } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';

const plannedMealFormSchema = z.object({
  name: PlanMealBody.shape.name,
  date: PlanMealBody.shape.date,
  recipeId: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string(),
      measureId: z.string(),
      amount: z.number().positive('Enter an amount greater than 0 for each ingredient.'),
      allocations: z.array(
        z.object({
          pantryItemId: z.string(),
          amount: z.number().min(0),
        })
      ),
    })
  ),
});

type AllocationRow = {
  key: number;
  pantryItemId: string;
  pantryItemName: string;
  amount: string;
};

const EMPTY_ALLOCATION_KEY = -1;

type RowState = {
  key: number;
  name: string;
  measureId: MeasureId;
  amount: string;
  allocations: AllocationRow[];
};

export type PlannedMealFormItem = {
  name: string;
  measureId: MeasureId;
  amount: number;
  allocations: Array<{ pantryItemId: string; amount: number }>;
};

export type PlannedMealFormValues = {
  name: string;
  date: string;
  recipeId: string;
  items: PlannedMealFormItem[];
};

export type PlannedMealFormInitial = PlannedMealFormValues;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function itemsToRows(items: PlannedMealFormItem[]): RowState[] {
  let nextAllocationKey = 0;
  return items.map((item, index) => ({
    key: index,
    name: item.name,
    measureId: item.measureId,
    amount: String(item.amount),
    allocations: item.allocations.map((allocation) => ({
      key: nextAllocationKey++,
      pantryItemId: allocation.pantryItemId,
      pantryItemName: '',
      amount: String(allocation.amount),
    })),
  }));
}

function AllocationLine({
  allocation,
  pantryItems,
  chosenElsewhereInRow,
  amountStillNeeded,
  onChange,
  onRemove,
  removable,
}: {
  allocation: AllocationRow;
  pantryItems: PantryItem[];
  chosenElsewhereInRow: Set<string>;
  amountStillNeeded: number;
  onChange: (allocation: AllocationRow) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const selectable = pantryItems.filter(
    (item) => item.uuid === allocation.pantryItemId || !chosenElsewhereInRow.has(item.uuid)
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        aria-label="From stock:"
        value={allocation.pantryItemId}
        onChange={(e) => {
          const item = pantryItems.find((i) => i.uuid === e.target.value);
          if (!item) {
            onChange({ ...allocation, pantryItemId: '', pantryItemName: '' });
            return;
          }
          onChange({
            ...allocation,
            pantryItemId: item.uuid,
            pantryItemName: item.name,
            amount: String(Math.min(item.remaining, amountStillNeeded || item.remaining)),
          });
        }}
        className="flex-1 min-w-0 p-1.5 border border-[#ccc] rounded"
      >
        <option value="">— none, add to shopping list —</option>
        {selectable.map((item) => (
          <option key={item.uuid} value={item.uuid}>
            {item.brand ? `${item.brand} ` : ''}{item.name} ({item.remaining} {item.measure} left)
          </option>
        ))}
      </select>
      {allocation.pantryItemId && (
        <input
          type="number"
          min="0"
          step="any"
          aria-label="Amount used from stock"
          value={allocation.amount}
          onChange={(e) => onChange({ ...allocation, amount: e.target.value })}
          className="field w-24 min-w-0 p-1.5"
        />
      )}
      {removable && (
        <button type="button" onClick={onRemove} aria-label="Remove allocation" className="shrink-0">×</button>
      )}
    </div>
  );
}

function IngredientRow({
  row,
  measures,
  pantryItems,
  recipeId,
  excludeMealId,
  onChange,
  onRemove,
}: {
  row: RowState;
  measures: Measure[];
  pantryItems: PantryItem[];
  recipeId: string;
  excludeMealId?: string;
  onChange: (row: RowState) => void;
  onRemove: () => void;
}) {
  const debouncedName = useDebouncedValue(row.name.trim(), 400);
  const autoFilledFor = useRef<Set<string>>(new Set());
  const nextAllocationKey = useRef(1000000 + row.key * 1000);

  const { data: suggestionsResponse } = useSuggestPantryItemsForPlannedMeal(
    { recipeId: recipeId || undefined, excludeMealId, ingredient: debouncedName },
    { swr: { enabled: Boolean(debouncedName) } }
  );
  const suggestions =
    suggestionsResponse && isSuccessResponse(suggestionsResponse) ? suggestionsResponse.data : undefined;

  useEffect(() => {
    if (!suggestions || !debouncedName) return;
    const autoFillKey = `${row.key}:${debouncedName}`;
    if (autoFilledFor.current.has(autoFillKey)) return;
    autoFilledFor.current.add(autoFillKey);
    if (row.allocations.length > 0) return;

    const amountNeeded = parseFloat(row.amount) || 0;
    let remaining = amountNeeded;
    const newAllocations: AllocationRow[] = [];
    for (const suggestion of suggestions) {
      if (remaining <= 0) break;
      if (suggestion.available <= 0) continue;
      const amount = Math.min(suggestion.available, remaining);
      newAllocations.push({
        key: nextAllocationKey.current++,
        pantryItemId: suggestion.uuid,
        pantryItemName: suggestion.name,
        amount: String(amount),
      });
      remaining -= amount;
    }
    if (newAllocations.length > 0) {
      onChange({ ...row, allocations: newAllocations });
    }
  }, [suggestions, debouncedName, row, onChange]);

  function updateAllocation(key: number, updated: AllocationRow) {
    if (key === EMPTY_ALLOCATION_KEY) {
      if (!updated.pantryItemId) return;
      onChange({ ...row, allocations: [...row.allocations, { ...updated, key: nextAllocationKey.current++ }] });
      return;
    }
    onChange({ ...row, allocations: row.allocations.map((a) => (a.key === key ? updated : a)) });
  }

  function removeAllocation(key: number) {
    onChange({ ...row, allocations: row.allocations.filter((a) => a.key !== key) });
  }

  function addAllocation() {
    onChange({
      ...row,
      allocations: [...row.allocations, { key: nextAllocationKey.current++, pantryItemId: '', pantryItemName: '', amount: '' }],
    });
  }

  const displayAllocations =
    row.allocations.length > 0
      ? row.allocations
      : [{ key: EMPTY_ALLOCATION_KEY, pantryItemId: '', pantryItemName: '', amount: '' }];

  const suggestedIds = new Set((suggestions ?? []).map((s) => s.uuid));
  const rankedPantryItems = [
    ...(suggestions ?? []).flatMap((s) => {
      const item = pantryItems.find((p) => p.uuid === s.uuid);
      return item ? [item] : [];
    }),
    ...pantryItems.filter((item) => !suggestedIds.has(item.uuid)),
  ];

  return (
    <li className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_6rem_2rem] gap-x-2 gap-y-1 border-b border-[#eee] pb-2">
      <input
        type="text"
        aria-label="Ingredient name"
        value={row.name}
        onChange={(e) => onChange({ ...row, name: e.target.value })}
        placeholder="Ingredient name…"
        className="field col-span-2 sm:col-span-1 min-w-0"
      />
      <select
        aria-label="Measure"
        value={row.measureId || measures[0]?.measureId || ''}
        onChange={(e) => onChange({ ...row, measureId: e.target.value as MeasureId })}
        className="field w-full min-w-0"
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
          className="field w-full min-w-0"
        />
        <button type="button" onClick={onRemove} aria-label="Remove ingredient" className="shrink-0">×</button>
      </div>

      <div className="col-span-2 sm:col-span-4 grid gap-1.5">
        <span className="text-sm text-[#666]">From stock:</span>
        {displayAllocations.map((allocation) => (
          <AllocationLine
            key={allocation.key}
            allocation={allocation}
            pantryItems={rankedPantryItems}
            chosenElsewhereInRow={
              new Set(row.allocations.filter((a) => a.key !== allocation.key).map((a) => a.pantryItemId))
            }
            amountStillNeeded={
              (parseFloat(row.amount) || 0) -
              row.allocations
                .filter((a) => a.key !== allocation.key)
                .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
            }
            onChange={(updated) => updateAllocation(allocation.key, updated)}
            onRemove={() => removeAllocation(allocation.key)}
            removable={allocation.key !== EMPTY_ALLOCATION_KEY}
          />
        ))}
        <button type="button" onClick={addAllocation} className="text-sm w-fit">
          + add another from stock
        </button>
      </div>
    </li>
  );
}

interface Props {
  initial?: PlannedMealFormInitial;
  submitLabel: string;
  excludeMealId?: string;
  onSubmit: (values: PlannedMealFormValues) => Promise<string | void>;
  onDelete?: () => void;
}

export default function PlannedMealForm({ initial, submitLabel, excludeMealId, onSubmit, onDelete }: Props) {
  const router = useRouter();
  const activeHouse = useActiveHouse();
  const measures = useMeasures();
  const { data: recipesResponse } = useFindAllRecipes({ swr: { enabled: Boolean(activeHouse) } });
  const { data: pantryResponse } = useFindAllPantryItems(undefined, { swr: { enabled: Boolean(activeHouse) } });
  const recipes = recipesResponse && isSuccessResponse(recipesResponse)
    ? recipesResponse.data.map((r) => toRecipe(r as BackendRecipe))
    : undefined;
  const pantryItems = pantryResponse && isSuccessResponse(pantryResponse) ? pantryResponse.data : undefined;

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
        allocations: [],
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
      allocations: [],
    }]);
    setNewIngredientName('');
    setNewIngredientAmount('');
  }

  const [error, handleSubmit, submitting] = useActionState(async (): Promise<string | null> => {
    const filledRows = rows.filter((r) => r.name.trim());

    const result = plannedMealFormSchema.safeParse({
      name: name.trim(),
      date,
      recipeId,
      items: filledRows.map((row) => ({
        name: row.name.trim(),
        measureId: row.measureId || measures[0]?.measureId || '',
        amount: parseFloat(row.amount),
        allocations: row.allocations
          .filter((a) => a.pantryItemId)
          .map((a) => ({ pantryItemId: a.pantryItemId, amount: parseFloat(a.amount || '0') })),
      })),
    });

    if (!result.success) {
      return result.error.issues[0]?.message ?? 'Please check the form for errors.';
    }

    try {
      const items: PlannedMealFormItem[] = result.data.items.map((item) => ({
        name: item.name,
        measureId: item.measureId as MeasureId,
        amount: item.amount,
        allocations: item.allocations,
      }));

      const errorMessage = await onSubmit({
        name: result.data.name,
        date: result.data.date,
        recipeId: result.data.recipeId ?? '',
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
            className="field w-fit"
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
            className="field w-full sm:flex-1 min-w-0"
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
            className="field col-span-2 sm:col-span-1 min-w-0"
          />
          <select
            aria-label="New ingredient measure"
            value={newIngredientMeasure || measures[0]?.measureId || ''}
            onChange={(e) => setNewIngredientMeasure(e.target.value as MeasureId)}
            className="field min-w-0"
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
            className="field min-w-0"
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
                recipeId={recipeId}
                excludeMealId={excludeMealId}
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
            className="btn-danger"
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
