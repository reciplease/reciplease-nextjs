import type { components } from '@/types/generated/api';
import { shorten } from './recipe-id';

export type BackendIngredient = components['schemas']['RecipeIngredient'];
export type BackendPublicRecipe = components['schemas']['PublicRecipe'];
export type BackendOwnedRecipe = components['schemas']['OwnedRecipe'];
export type BackendRecipe = BackendPublicRecipe | BackendOwnedRecipe;

// The generated DTO types mark every field optional (the backend's OpenAPI
// schema doesn't declare which fields are always present), so this mapper
// defaults everything defensively even though recipeId/name are in practice
// always set by the backend.
//
// The backend returns ingredients/measures as raw measureId strings — no
// expansion happens here or anywhere else; components that need to display a
// measure's name look it up via `useMeasures()`/`findMeasure()`. This mapper's
// only job is deriving the UI-only `recipeShortId`, filling in nullable
// defaults, and narrowing on `owned` into the matching frontend union member.
export function toRecipe(b: BackendRecipe): Recipe {
  const base: BaseRecipe = {
    recipeId: b.recipeId ?? '',
    recipeShortId: shorten(b.recipeId ?? ''),
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

  if (!b.owned) {
    return { ...base, owned: false };
  }

  // `owned: true` on the wire guarantees this is a BackendOwnedRecipe — the generated
  // schema types don't literal-tag `owned`, so TS can't narrow the union on its own.
  const owned = b as BackendOwnedRecipe;
  return {
    ...base,
    owned: true,
    houseId: owned.houseId ?? '',
    createdBy: owned.createdBy ? { userId: owned.createdBy.userId ?? '', handle: owned.createdBy.handle ?? null } : null,
    updatedBy: owned.updatedBy ? { userId: owned.updatedBy.userId ?? '', handle: owned.updatedBy.handle ?? null } : null,
  };
}
