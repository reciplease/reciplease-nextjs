import { apiFetch } from '@/lib/houses';
import type { components } from '@/types/generated/api';

export type Nutrients = components['schemas']['Nutrients'];

export type FoodSearchResult = components['schemas']['FoodSearchResultDto'];

export function searchFood(query: string): Promise<FoodSearchResult[]> {
  return apiFetch(`/api/food/search?query=${encodeURIComponent(query)}`)
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);
}

export function searchFoodByBarcode(barcode: string): Promise<FoodSearchResult | null> {
  return apiFetch(`/api/food/barcode/${encodeURIComponent(barcode)}`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
}
