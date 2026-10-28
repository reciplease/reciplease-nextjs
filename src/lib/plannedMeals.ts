import type { components } from '@/types/generated/api';
import { shorten } from '@/lib/recipe-id';
import { toRecipe } from '@/lib/recipes';

export type BackendPlannedMeal = components['schemas']['PlannedMeal'];
export type BackendPlannedIngredient = components['schemas']['PlannedIngredient'];
export type BackendShoppingList = components['schemas']['ShoppingList'];

export function toPlannedMeal(b: BackendPlannedMeal): PlannedMeal {
  return {
    ...b,
    plannedMealShortId: shorten(b.plannedMealId),
    recipe: b.recipe ? toRecipe(b.recipe) : undefined,
  };
}

export function toShoppingList(b: BackendShoppingList): ShoppingList {
  return b;
}
