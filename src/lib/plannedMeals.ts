import type { components } from '@/types/generated/api';
import { shorten } from '@/lib/recipe-id';
import { toRecipe } from '@/lib/recipes';

export type BackendPlannedMeal = components['schemas']['PlannedMeal'];
export type BackendPlannedIngredient = components['schemas']['PlannedIngredient'];
export type BackendShoppingList = components['schemas']['ShoppingList'];

// Mirrors toRecipe: the frontend `PlannedMeal` type is now the generated
// PlannedMeal schema type verbatim plus a UI-only `plannedMealShortId`, so
// the only real work left is deriving that short id and routing `recipe`
// (which stays genuinely nullable — null when the meal has no recipeId)
// through toRecipe so it too picks up its own `recipeShortId`.
export function toPlannedMeal(b: BackendPlannedMeal): PlannedMeal {
  return {
    ...b,
    plannedMealShortId: shorten(b.plannedMealId),
    recipe: b.recipe ? toRecipe(b.recipe) : undefined,
  };
}

// `ShoppingList` is now just the generated schema type verbatim — no UI-only
// fields added, nothing nullable to handle, and PlannedIngredient (the
// items on a PlannedMeal) needed no separate mapping at all any more (see
// toPlannedMeal's `...b` spread above), so the old internal
// `toPlannedIngredient` helper is gone entirely. toShoppingList itself is a
// genuine identity pass-through at this point; kept as a named export only
// because callers already import it (see
// src/pages/planner/shopping-list.tsx) — inlining the identity is a
// call-site decision, not one to make blindly here.
export function toShoppingList(b: BackendShoppingList): ShoppingList {
  return b;
}
