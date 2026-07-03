import { apiFetch } from '@/lib/houses';

// Hand-written rather than pulled from the generated OpenAPI types: the
// backend endpoints haven't landed yet, so this is a reasonable contract to
// build the frontend against. Reconcile with `@/types/generated/api` once the
// backend ships and springdoc has a real schema for these.

export type Nutrients = {
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydrateG: number | null;
};

export type FoodSearchResult = {
  source: 'HISTORY' | 'CATALOG';
  displayName: string;
  identifiedFoodId: string | null;
  nutrients: Nutrients | null;
};

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
