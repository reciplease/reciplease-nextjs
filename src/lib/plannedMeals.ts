import type { components } from '@/types/generated/api';
import { shorten } from '@/lib/recipe-id';
import { toRecipe, type BackendRecipe } from '@/lib/recipes';

export type BackendPlannedMeal = components['schemas']['PlannedMeal'];
export type BackendPlannedIngredient = components['schemas']['PlannedIngredient'];
export type BackendShoppingList = components['schemas']['ShoppingList'];

// Mirrors toRecipe: the generated DTO marks every field optional, so this
// mapper defaults defensively even though name/date are in practice always set.
export function toPlannedMeal(b: BackendPlannedMeal): PlannedMeal {
  const plannedMealId = b.plannedMealId ?? '';
  return {
    plannedMealId,
    plannedMealShortId: plannedMealId ? shorten(plannedMealId) : '',
    houseId: b.houseId ?? '',
    name: b.name ?? '',
    recipe: b.recipe ? toRecipe(b.recipe as BackendRecipe) : undefined,
    date: b.date ?? '',
    items: (b.items ?? []).map(toPlannedIngredient),
    eatenAt: b.eatenAt,
  };
}

function toPlannedIngredient(b: BackendPlannedIngredient): PlannedIngredient {
  return {
    ingredient: {
      name: b.ingredient?.name ?? '',
      measure: (b.ingredient?.measure ?? '') as MeasureId,
      amount: b.ingredient?.amount ?? 0,
    },
    allocations: (b.allocations ?? []).map((a) => ({
      pantryItemId: a.pantryItemId ?? '',
      amount: a.amount ?? 0,
      barcode: a.barcode,
    })),
  };
}

export function toShoppingList(b: BackendShoppingList): ShoppingList {
  return {
    items: (b.items ?? []).map((i) => ({
      name: i.name ?? '',
      measure: (i.measure ?? '') as MeasureId,
      amount: i.amount ?? 0,
    })),
  };
}
