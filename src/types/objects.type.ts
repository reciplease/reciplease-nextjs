type Recipe = {
  recipeId: RecipeId;
  recipeShortId: RecipeShortId;
  houseId: string | null;
  isPublic: boolean;
  name: string;
  description: string | null;
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

type CreateRecipeIngredient = {
  name: string;
  measureId: MeasureId;
  amount: number;
};

// A physical pantry item. Carries its own name/measure plus an optional barcode
// (recorded when scanned) used to suggest items when planning a recipe again.
// `measure` is the raw measureId as returned by the backend.
type InventoryItem = {
  uuid: InventoryItemId;
  name: string;
  measure: MeasureId;
  amount: number;
  expiration: string;
  barcode?: string;
  // Raw base64 JPEG bytes (no `data:` prefix) — prepend one to render.
  image?: string;
  updatedAt?: string;
};

type CreateInventoryItem = {
  name: string;
  measureId: MeasureId;
  amount: number;
  expiration: string;
  barcode?: string;
  image?: string;
};

// Static reference data served from the backend (a Java enum). The short name
// doubles as the measureId (e.g. "g", "kg", "cl").
type Measure = {
  measureId: MeasureId;
  singular: string;
  plural: string;
  short: string;
};
