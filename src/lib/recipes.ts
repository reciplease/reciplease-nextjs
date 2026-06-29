import { shorten } from './recipe-id';

export type BackendIngredient = {
  name: string;
  measure: string;
  amount: number;
};

export type BackendRecipe = {
  recipeId: string;
  houseId: string | null;
  isPublic: boolean;
  name: string;
  description: string | null;
  sourceUrl?: string | null;
  steps: string[] | null;
  ingredients: BackendIngredient[];
  updatedAt?: string;
};

// The backend returns ingredients/measures as raw measureId strings — no
// expansion happens here or anywhere else; components that need to display a
// measure's name look it up via `useMeasures()`/`findMeasure()`. This mapper's
// only job is deriving the UI-only `recipeShortId` and filling in nullable
// defaults.
export function toRecipe(b: BackendRecipe): Recipe {
  return {
    recipeId: b.recipeId,
    recipeShortId: shorten(b.recipeId),
    houseId: b.houseId ?? null,
    isPublic: b.isPublic ?? false,
    name: b.name,
    description: b.description ?? null,
    sourceUrl: b.sourceUrl ?? null,
    steps: b.steps ?? [],
    ingredients: (b.ingredients ?? []).map((i) => ({
      name: i.name,
      measure: i.measure,
      amount: i.amount,
    })),
    updatedAt: b.updatedAt,
  };
}
