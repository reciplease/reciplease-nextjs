type Recipe = {
  recipeId: RecipeId;
  recipeShortId: RecipeShortId;
  name: string;
  description: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
};

type RecipeIngredient = {
  ingredientId: IngredientId;
  name: string;
  measure: Measure;
  amount: number;
};

type Ingredient = {
  uuid: IngredientId;
  name: string;
  measure: Measure;
};

type CreateIngredient = {
  name: string;
  measureId: MeasureId;
};

type InventoryItem = {
  uuid: InventoryItemId;
  ingredientUuid: IngredientId;
  name: string;
  measure: Measure;
  amount: number;
  expiration: string;
};

type CreateInventoryItem = {
  ingredientUuid: IngredientId;
  amount: number;
  expiration: string;
};

type Measure = {
  measureId: MeasureId;
  singular: string;
  plural: string;
};
