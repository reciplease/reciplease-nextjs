import type { components } from '@/types/generated/api';

// These types are consumed as bare globals throughout the app (no import
// needed) — `declare global` preserves that while still tying them directly
// to the generated OpenAPI schema, which now correctly marks fields
// required/optional to match what the backend actually always returns.
declare global {
  // The shared shape both recipe views allOf onto — never carries owner or
  // user info on its own, since PublicRecipe (returned to anonymous/public
  // browsing and to anyone who isn't the owner) must never expose them.
  type BaseRecipe = components['schemas']['RecipeDto'];

  // Adds the UI-only `recipeShortId` (derived client-side from `recipeId`,
  // see lib/recipes.ts) on top of the generated, now-fully-required schema.
  type PublicRecipe = components['schemas']['PublicRecipe'] & {
    recipeShortId: RecipeShortId;
  };

  // Only returned to the recipe's owner — carries createdBy/updatedBy and who
  // created/last updated it.
  type OwnedRecipe = components['schemas']['OwnedRecipe'] & {
    recipeShortId: RecipeShortId;
  };

  // Discriminated on `owned` — only OwnedRecipe (owned === 'true') grants its
  // owner edit/toggle rights.
  type Recipe = PublicRecipe | OwnedRecipe;

  // Public-safe subset of a user for display — no email or provider identity.
  type UserSummary = components['schemas']['UserSummary'];

  // A recipe ingredient is a self-contained spec: it is not linked to any pantry
  // item. Pantry is only paired with a recipe ingredient when a recipe is planned.
  // `measure` is the raw measureId as returned by the backend — components needing
  // to display it look it up via `useMeasures()`/`findMeasure()`.
  type RecipeIngredient = components['schemas']['RecipeIngredient'];

  // A physical pantry item. Carries its own name/measure plus an optional barcode
  // (recorded when scanned) used to suggest items when planning a recipe again.
  // `measure` is the raw measureId as returned by the backend. Omits the backend's
  // `houseId` (unused by the UI).
  type PantryItem = Omit<components['schemas']['PantryItem'], 'houseId'>;

  type CreatePantryItem = Pick<
    components['schemas']['PantryItem'],
    'name' | 'measure' | 'amount' | 'expiration' | 'brand' | 'barcode' | 'image'
  >;

  // A shopping-trip capture (barcode photo + other photos) awaiting digitisation into
  // a PantryItem — every capture step is skippable, so all fields but the id are
  // optional. The barcode itself isn't decoded until processing; only its photo is
  // captured here. The images are base64 like PantryItem.image. `legacyBarcode` is a
  // read-only leftover from before capture switched to photos — an already-decoded
  // barcode on items captured before that change; never present on anything new.
  // Omits the backend's `houseId` (unused by the UI).
  type PendingPantryItem = Omit<components['schemas']['PendingPantryItem'], 'houseId'>;

  type CreatePendingPantryItem = Pick<
    components['schemas']['PendingPantryItem'],
    'barcodeImage' | 'expirationImage' | 'measureImage'
  >;

  // Static reference data served from the backend (a Java enum). The short name
  // doubles as the measureId (e.g. "g", "kg", "cl").
  type Measure = components['schemas']['Measure'];

  // What was drawn from a specific pantry item to (partially) satisfy a
  // PlannedIngredient. `barcode` is snapshotted server-side, never client-supplied.
  type PantryAllocation = components['schemas']['PantryAllocation'];

  // A single ingredient placeholder within a planned meal. `allocations` may be
  // empty, or not fully cover `ingredient.amount` — the remainder is exactly what
  // shows up on the shopping list (see ShoppingList below).
  type PlannedIngredient = components['schemas']['PlannedIngredient'];

  // A timed placeholder for eating/using pantry items on a given date. `recipe` is
  // optional context (only present when the meal was planned from a recipe) — the
  // meal's own `name` is what's always shown and must be unique per day. Adds the
  // UI-only `plannedMealShortId` (derived client-side, see lib/plannedMeals.ts).
  type PlannedMeal = components['schemas']['PlannedMeal'] & {
    plannedMealShortId: PlannedMealShortId;
  };

  // The unmet gap between what's planned and what's already covered by pantry
  // allocations, aggregated across every planned meal in a date range.
  type ShoppingList = components['schemas']['ShoppingList'];
}

export {};
