import { shorten } from './recipe-id';
import { toMeasure } from './measures';

export type BackendIngredient = {
  name: string;
  measure: string;
  amount: number;
};

export type BackendRecipe = {
  recipeId: string;
  name: string;
  description: string | null;
  steps: string[] | null;
  ingredients: BackendIngredient[];
  updatedAt?: string;
  editable?: boolean;
};

export function toRecipe(b: BackendRecipe, measures: Measure[]): Recipe {
  return {
    recipeId: b.recipeId,
    recipeShortId: shorten(b.recipeId),
    name: b.name,
    description: b.description ?? null,
    steps: b.steps ?? [],
    ingredients: (b.ingredients ?? []).map((i) => ({
      name: i.name,
      measure: toMeasure(i.measure, measures),
      amount: i.amount,
    })),
    updatedAt: b.updatedAt,
    editable: b.editable ?? false,
  };
}
