import type { components } from '@/types/generated/api';

// These types are consumed as bare globals throughout the app (no import
// needed) — `declare global` preserves that while still tying the
// directly-wire-mirroring ones (PantryItem/CreatePantryItem/Measure)
// to the generated OpenAPI schema.
declare global {
  // Fields common to both recipe views — never includes house or user info, since
  // PublicRecipe (returned to anonymous/public browsing and to callers outside the
  // recipe's own house) must never carry them.
  type BaseRecipe = {
    recipeId: RecipeId;
    recipeShortId: RecipeShortId;
    isPublic: boolean;
    name: string;
    description: string | null;
    sourceUrl?: string | null;
    ingredients: RecipeIngredient[];
    steps: string[];
    updatedAt?: string;
  };

  type PublicRecipe = BaseRecipe & { owned: false };

  // Only returned to an authenticated caller who is a member of the recipe's own
  // house — carries houseId and who created/last updated it.
  type OwnedRecipe = BaseRecipe & {
    owned: true;
    houseId: string;
    createdBy: UserSummary | null;
    updatedBy: UserSummary | null;
  };

  // Discriminated on `owned` — narrow with `if (recipe.owned) { ... recipe.houseId ... }`.
  type Recipe = PublicRecipe | OwnedRecipe;

  // Public-safe subset of a user for display — no email or provider identity.
  type UserSummary = {
    userId: string;
    handle: string | null;
  };

  // A recipe ingredient is a self-contained spec: it is not linked to any pantry
  // item. Pantry is only paired with a recipe ingredient when a recipe is planned.
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
  type PantryItem = Required<
    Pick<components['schemas']['PantryItem'], 'uuid' | 'name' | 'measure' | 'amount' | 'remaining' | 'expiration'>
  > &
    Pick<components['schemas']['PantryItem'], 'brand' | 'barcode' | 'image' | 'createdAt' | 'updatedAt'>;

  type CreatePantryItem = Required<
    Pick<components['schemas']['PantryItem'], 'name' | 'measure' | 'amount' | 'expiration'>
  > &
    Pick<components['schemas']['PantryItem'], 'brand' | 'barcode' | 'image'>;

  // A shopping-trip capture (barcode photo + other photos) awaiting digitisation into
  // a PantryItem — every capture step is skippable, so all fields but the id are
  // optional. The barcode itself isn't decoded until processing; only its photo is
  // captured here. The images are base64 like PantryItem.image. `legacyBarcode` is a
  // read-only leftover from before capture switched to photos — an already-decoded
  // barcode on items captured before that change; never present on anything new.
  type PendingPantryItem = Required<Pick<components['schemas']['PendingPantryItem'], 'uuid'>> &
    Pick<components['schemas']['PendingPantryItem'], 'barcodeImage' | 'legacyBarcode' | 'expirationImage' | 'measureImage' | 'updatedAt'>;

  type CreatePendingPantryItem = Pick<
    components['schemas']['PendingPantryItem'],
    'barcodeImage' | 'expirationImage' | 'measureImage'
  >;

  // Static reference data served from the backend (a Java enum). The short name
  // doubles as the measureId (e.g. "g", "kg", "cl").
  type Measure = Required<components['schemas']['Measure']>;

  // What was drawn from a specific pantry item to (partially) satisfy a
  // PlannedIngredient. `barcode` is snapshotted server-side, never client-supplied.
  type PantryAllocation = Required<
    Pick<components['schemas']['PantryAllocation'], 'pantryItemId' | 'amount'>
  > &
    Pick<components['schemas']['PantryAllocation'], 'barcode'>;

  // A single ingredient placeholder within a planned meal. `allocations` may be
  // empty, or not fully cover `ingredient.amount` — the remainder is exactly what
  // shows up on the shopping list (see ShoppingList below).
  type PlannedIngredient = {
    ingredient: RecipeIngredient;
    allocations: PantryAllocation[];
  };

  // A timed placeholder for eating/using pantry items on a given date. `recipe` is
  // optional context (only present when the meal was planned from a recipe) — the
  // meal's own `name` is what's always shown and must be unique per day.
  type PlannedMeal = {
    plannedMealId: PlannedMealId;
    plannedMealShortId: PlannedMealShortId;
    houseId: string;
    name: string;
    recipe?: Recipe;
    date: string;
    items: PlannedIngredient[];
    eatenAt?: string;
  };

  // The unmet gap between what's planned and what's already covered by pantry
  // allocations, aggregated across every planned meal in a date range.
  type ShoppingList = {
    items: RecipeIngredient[];
  };
}

export {};
