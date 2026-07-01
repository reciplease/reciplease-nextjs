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
}

export {};
