import type { components } from '@/types/generated/api';
import { shorten } from './recipe-id';

export type BackendIngredient = components['schemas']['RecipeIngredient'];
export type BackendRecipe = components['schemas']['Recipe'];

export function toRecipe(b: BackendRecipe): Recipe {
  return { ...b, recipeShortId: shorten(b.recipeId) };
}
