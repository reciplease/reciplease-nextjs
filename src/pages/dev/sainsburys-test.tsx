import { FormEvent, useState } from 'react';
import Metadata from '@/components/Metadata';

interface SainsburysProduct {
  product_uid: string;
  name: string;
  retail_price?: { price: number };
  unit_price?: { price: number; measure: string };
  is_available?: boolean;
  image?: string;
  categories?: { id: string; name: string }[];
}

// One-off experiment, not a real feature: probes whether a client-side browser fetch to
// Sainsbury's unofficial product-search endpoint gets through Akamai's bot protection and
// CORS, since a server-side call (curl, Spring RestClient) is flatly 403'd even from a real
// residential network. If this works, the full shopping-list-matching feature can be designed
// around it; if it fails (most likely CORS, since Sainsbury's almost certainly doesn't send
// Access-Control-Allow-Origin for third-party origins), that decides the fallback instead.
export default function SainsburysTest() {
  const [query, setQuery] = useState('milk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<SainsburysProduct[] | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProducts(null);
    try {
      const url = `https://www.sainsburys.co.uk/groceries-api/gol-services/product/v1/product?filter[keyword]=${encodeURIComponent(query)}&page_number=1&page_size=5`;
      const res = await fetch(url);
      if (!res.ok) {
        setError(`HTTP ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch (err) {
      // A CORS failure or network block surfaces here as an opaque TypeError, not a
      // response we can inspect — that itself is the answer to what we're testing.
      setError(err instanceof Error ? err.message : 'Request failed (likely CORS or a network block)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Metadata title="Sainsbury's fetch test" description="Dev-only experiment: client-side fetch to Sainsbury's" />

      <section className="grid gap-4">
        <h3 className="text-xl font-semibold">Sainsbury&apos;s browser-fetch experiment</h3>
        <p className="text-sm text-[#666]">
          Dev-only page. Tests whether a client-side <code>fetch()</code> from your browser reaches
          Sainsbury&apos;s product-search endpoint (bypassing Akamai) and clears CORS — a
          server-side call is blocked outright even from a real residential network.
        </p>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="query" className="sr-only">Search term</label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-48 rounded border-2 border-secondary p-2 text-base"
          />
          <button type="submit" disabled={loading || !query.trim()} className="cursor-pointer px-3 py-2 text-sm">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            Failed: {error}
          </p>
        )}

        {products && products.length === 0 && <p>No products returned.</p>}

        {products && products.length > 0 && (
          <ul className="grid gap-2">
            {products.map((p) => (
              <li key={p.product_uid} className="rounded border border-[#ccc] p-2 text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-[#666]">
                  {p.retail_price ? `£${p.retail_price.price.toFixed(2)}` : 'No price'}
                  {p.unit_price ? ` (£${p.unit_price.price.toFixed(2)}/${p.unit_price.measure})` : ''}
                  {' · '}
                  {p.is_available ? 'In stock' : 'Out of stock'}
                </p>
                {p.categories && p.categories.length > 0 && (
                  <p className="text-[#666]">Category: {p.categories[0].name}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
