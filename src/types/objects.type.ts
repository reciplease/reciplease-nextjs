type Recipe = {
  recipeId: RecipeId;
  recipeShortId: RecipeShortId;
  name: string;
  description: string;
  ingredients: Ingredient[];
  steps: string[];
};

type Ingredient = {
  ingredientId: IngredientId;
  name: string;
  measure: Measure;
  amount: number;
};

type Measure = {
  measureId: MeasureId;
  singular: string;
  plural: string;
};
