type Recipe = {
  recipeId: RecipeId;
  recipeShortId: RecipeShortId;
  name: string;
  description: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
};

// A recipe ingredient is a self-contained spec: it is not linked to any inventory
// item. Inventory is only paired with a recipe ingredient when a recipe is planned.
type RecipeIngredient = {
  name: string;
  measure: Measure;
  amount: number;
};

type CreateRecipeIngredient = {
  name: string;
  measureId: MeasureId;
  amount: number;
};

// A physical pantry item. Carries its own name/measure plus an optional barcode
// (recorded when scanned) used to suggest items when planning a recipe again.
type InventoryItem = {
  uuid: InventoryItemId;
  name: string;
  measure: Measure;
  amount: number;
  expiration: string;
  barcode?: string;
};

type CreateInventoryItem = {
  name: string;
  measureId: MeasureId;
  amount: number;
  expiration: string;
  barcode?: string;
};

type Measure = {
  measureId: MeasureId;
  singular: string;
  plural: string;
};

type CreateMeasure = {
  singular: string;
  plural: string;
};
