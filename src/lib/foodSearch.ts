import { searchFoods, findFoodByBarcode } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';
import type { components } from '@/types/generated/api';

export type Nutrients = components['schemas']['Nutrients'];

export type FoodSearchResult = components['schemas']['FoodSearchResultDto'];

export function searchFood(query: string): Promise<FoodSearchResult[]> {
  return searchFoods({ query })
    .then((res) => (isSuccessResponse(res) ? res.data : []))
    .catch(() => []);
}

export function searchFoodByBarcode(barcode: string): Promise<FoodSearchResult | null> {
  return findFoodByBarcode(barcode)
    .then((res) => (isSuccessResponse(res) ? res.data : null))
    .catch(() => null);
}
