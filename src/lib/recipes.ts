import type { components } from '@/types/generated/api';
import { shorten } from './recipe-id';

export type BackendIngredient = components['schemas']['RecipeIngredient'];
export type BackendPublicRecipe = components['schemas']['PublicRecipe'];
export type BackendOwnedRecipe = components['schemas']['OwnedRecipe'];
export type BackendRecipe = BackendPublicRecipe | BackendOwnedRecipe;

// The frontend `Recipe` type (see src/types/objects.type.ts) is now the
// generated PublicRecipe/OwnedRecipe schema types verbatim, plus a UI-only
// `recipeShortId` — every field this mapper used to default (recipeId, name,
// steps, ingredients, updatedAt, isPublic, createdBy/updatedBy) is already
// exactly the shape the backend guarantees. So there's nothing left to map or
// narrow here beyond deriving `recipeShortId`; `b`'s own `owned: "true"|"false"`
// discriminator carries straight through to `Recipe` as-is.
export function toRecipe(b: BackendRecipe): Recipe {
  return { ...b, recipeShortId: shorten(b.recipeId) };
}
