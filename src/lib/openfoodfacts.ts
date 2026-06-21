// Naming-relevant fields from the OpenFoodFacts v2 product API. See
// https://openfoodfacts.github.io/openfoodfacts-server/api/ — `product_name`
// is the main label; the rest give useful alternatives the user can pick from.
// `quantity` (e.g. "33 cl", "500 g") is parsed into a measure suggestion.
const FIELDS = [
  'product_name',
  'generic_name',
  'abbreviated_product_name',
  'brands',
  'quantity',
  'categories',
  'image_front_small_url',
  'image_url',
].join(',');

export type ProductLookup = {
  // Distinct, human-readable name candidates (best-first) for a new item.
  nameCandidates: string[];
  // A suggested measure (matching an app measureId) parsed from the product
  // quantity, or null when the unit is missing or unrecognised.
  measureId: MeasureId | null;
  // A remote photo URL to fetch and persist locally, or null when unavailable.
  imageUrl: string | null;
};

/**
 * Looks a barcode up on OpenFoodFacts and returns name candidates plus a measure
 * suggestion derived from the product quantity. Returns empty results when the
 * product is unknown or the request fails.
 */
export async function lookupProduct(barcode: string): Promise<ProductLookup> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return { nameCandidates: [], measureId: null, imageUrl: null };
    const json = await res.json();
    if (json.status !== 1 || !json.product) {
      return { nameCandidates: [], measureId: null, imageUrl: null };
    }
    return {
      nameCandidates: candidatesFromProduct(json.product),
      measureId: measureIdFromQuantity(json.product.quantity ?? ''),
      imageUrl: json.product.image_front_small_url ?? json.product.image_url ?? null,
    };
  } catch {
    return { nameCandidates: [], measureId: null, imageUrl: null };
  }
}

type OFFProductFields = {
  product_name?: string;
  generic_name?: string;
  abbreviated_product_name?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  image_front_small_url?: string;
  image_url?: string;
};

function candidatesFromProduct(p: OFFProductFields): string[] {
  const productName = (p.product_name ?? '').trim();
  const genericName = (p.generic_name ?? '').trim();
  const abbreviated = (p.abbreviated_product_name ?? '').trim();
  // `brands` / `categories` are comma-separated lists; take the most useful one.
  const brand = (p.brands ?? '').split(',')[0]?.trim() as string;
  const category = (p.categories ?? '').split(',').pop()?.trim() as string;

  const candidates = [
    productName,
    brand && productName ? `${brand} ${productName}` : '',
    genericName,
    abbreviated,
    category,
  ];

  return candidates
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c, i, all) => all.indexOf(c) === i);
}

// OpenFoodFacts quantity units → app measureId (the measure's short name).
// Decilitres have no dedicated measure, so they fall back to millilitres.
const UNIT_TO_MEASURE_ID: Record<string, MeasureId> = {
  mg: 'g',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  cl: 'cl',
  dl: 'ml',
  l: 'l',
};

/**
 * Pulls a measure suggestion from a free-text quantity like "33 cl", "1 L" or
 * "6 x 25 g" (the last unit wins). Unknown or missing units yield null.
 */
export function measureIdFromQuantity(quantity: string): MeasureId | null {
  // The last number+unit token wins (handles multipacks like "6 x 33 cl").
  const tokens = quantity.match(/\d+(?:[.,]\d+)?\s*(?:mg|kg|cl|dl|ml|l|g)\b/gi);
  const lastToken = tokens?.[tokens.length - 1];
  const unit = lastToken?.match(/(mg|kg|cl|dl|ml|l|g)\b/i)?.[1]?.toLowerCase();
  return unit ? UNIT_TO_MEASURE_ID[unit] : null;
}
