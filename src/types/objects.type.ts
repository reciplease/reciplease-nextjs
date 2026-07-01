import type { components } from '@/types/generated/api';

// These types are consumed as bare globals throughout the app (no import
// needed) — `declare global` preserves that while still tying the
// directly-wire-mirroring ones (InventoryItem/CreateInventoryItem/Measure)
// to the generated OpenAPI schema.
declare global {
  type Recipe = {
    recipeId: RecipeId;
    recipeShortId: RecipeShortId;
    houseId: string | null;
    isPublic: boolean;
    name: string;
    description: string | null;
    sourceUrl?: string | null;
    ingredients: RecipeIngredient[];
    steps: string[];
    updatedAt?: string;
  };

  // A recipe ingredient is a self-contained spec: it is not linked to any inventory
  // item. Inventory is only paired with a recipe ingredient when a recipe is planned.
  // `measure` is the raw measureId as returned by the backend — components needing
  // to display it look it up via `useMeasures()`/`findMeasure()`.
  type RecipeIngredient = {
    name: string;
    measure: MeasureId;
    amount: number;
  };

  // A physical pantry item. Carries its own name/measure plus an optional barcode
  // (recorded when scanned) used to suggest items when planning a recipe again.
  // `measure` is the raw measureId as returned by the backend. Omits the backend's
  // `houseId` (unused by the UI) — picked rather than `Required<...>`'d wholesale.
  type InventoryItem = Required<
    Pick<components['schemas']['InventoryItem'], 'uuid' | 'name' | 'measure' | 'amount' | 'remaining' | 'expiration'>
  > &
    Pick<components['schemas']['InventoryItem'], 'barcode' | 'image' | 'updatedAt'>;

  type CreateInventoryItem = Required<
    Pick<components['schemas']['InventoryItem'], 'name' | 'measure' | 'amount' | 'expiration'>
  > &
    Pick<components['schemas']['InventoryItem'], 'barcode' | 'image'>;

  // Static reference data served from the backend (a Java enum). The short name
  // doubles as the measureId (e.g. "g", "kg", "cl").
  type Measure = Required<components['schemas']['Measure']>;

  // What was drawn from a specific inventory item to (partially) satisfy a
  // PlannedIngredient. `barcode` is snapshotted server-side, never client-supplied.
  type InventoryAllocation = Required<
    Pick<components['schemas']['InventoryAllocation'], 'inventoryItemId' | 'amount'>
  > &
    Pick<components['schemas']['InventoryAllocation'], 'barcode'>;

  // A single ingredient placeholder within a planned meal. `allocations` may be
  // empty, or not fully cover `ingredient.amount` — the remainder is exactly what
  // shows up on the shopping list (see ShoppingList below).
  type PlannedIngredient = {
    ingredient: RecipeIngredient;
    allocations: InventoryAllocation[];
  };

  // A timed placeholder for eating/using pantry items on a given date. `recipe` is
  // optional context (only present when the meal was planned from a recipe) — the
  // meal's own `name` is what's always shown and must be unique per day.
  type PlannedMeal = {
    houseId: string;
    name: string;
    recipe?: Recipe;
    date: string;
    items: PlannedIngredient[];
  };

  // The unmet gap between what's planned and what's already covered by inventory
  // allocations, aggregated across every planned meal in a date range.
  type ShoppingList = {
    items: RecipeIngredient[];
  };
}

export {};
