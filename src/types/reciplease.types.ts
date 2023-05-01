type Recipe = {
  recipeId: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
};

type Ingredient = {
  ingredientId: string;
  name: string;
  measure: string;
  amount: number;
};
