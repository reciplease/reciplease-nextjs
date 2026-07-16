import { lookupProduct } from '@/lib/openfoodfacts';
import { apiFetch } from '@/lib/houses';

export type ItemSuggestion = {
  name: string;
  measureId: string | null;
  source: 'inventory' | 'openfoodfacts' | null;
  candidates: string[];
  // OpenFoodFacts product photo, if any — left to the caller to fetch/compress
  // (browser canvas work) so this stays testable without a DOM.
  imageUrl: string | null;
};

// Suggests a name/measure for a scanned barcode: first from a previous inventory
// item with the same barcode (including expired ones, which still carry it), then
// falling back to OpenFoodFacts. Shared by the single-item scan flow and the
// shopping-trip processing flow.
export async function suggestItemFromBarcode(barcode: string): Promise<ItemSuggestion> {
  const suggestion: ItemSuggestion = {
    name: '',
    measureId: null,
    source: null,
    candidates: [],
    imageUrl: null,
  };

  try {
    const res = await apiFetch('/api/inventory');
    if (res.ok) {
      const items: InventoryItem[] = await res.json();
      const prior = items.find((it) => it.barcode === barcode);
      if (prior) {
        suggestion.name = prior.name;
        suggestion.measureId = prior.measure;
        suggestion.source = 'inventory';
      }
    }
  } catch {
    // Ignore and fall back to OpenFoodFacts below.
  }

  if (!suggestion.name) {
    const { nameCandidates, measureId, imageUrl } = await lookupProduct(barcode);
    suggestion.candidates = nameCandidates;
    suggestion.imageUrl = imageUrl;
    if (nameCandidates.length > 0) {
      suggestion.name = nameCandidates[0];
      suggestion.source = 'openfoodfacts';
    }
    if (measureId) {
      suggestion.measureId = measureId;
    }
  }

  return suggestion;
}
