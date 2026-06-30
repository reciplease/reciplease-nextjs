import type { components } from '@/types/generated/api';
import { shorten } from './recipe-id';

export type BackendIngredient = components['schemas']['RecipeIngredient'];
export type BackendRecipe = components['schemas']['Recipe'];

// The generated DTO types mark every field optional (the backend's OpenAPI
// schema doesn't declare which fields are always present), so this mapper
// defaults everything defensively even though recipeId/name are in practice
// always set by the backend.
//
// The backend returns ingredients/measures as raw measureId strings — no
// expansion happens here or anywhere else; components that need to display a
// measure's name look it up via `useMeasures()`/`findMeasure()`. This mapper's
// only job is deriving the UI-only `recipeShortId` and filling in nullable
// defaults.
export function toRecipe(b: BackendRecipe): Recipe {
  return {
    recipeId: b.recipeId ?? '',
    recipeShortId: shorten(b.recipeId ?? ''),
    houseId: b.houseId ?? null,
    isPublic: b.isPublic ?? false,
    name: b.name ?? '',
    description: b.description ?? null,
    sourceUrl: b.sourceUrl ?? null,
    steps: b.steps ?? [],
    ingredients: (b.ingredients ?? []).map((i) => ({
      name: i.name ?? '',
      measure: i.measure ?? '',
      amount: i.amount ?? 0,
    })),
    updatedAt: b.updatedAt,
  };
}
