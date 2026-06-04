export type OFFProduct = {
  productName: string;
  brands: string;
};

export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,brands`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    return {
      productName: json.product.product_name ?? '',
      brands: json.product.brands ?? '',
    };
  } catch {
    return null;
  }
}
