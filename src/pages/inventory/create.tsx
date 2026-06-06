import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';

const fetcher = (url: string): Promise<Measure[]> =>
  fetch(url).then((res) => res.json());

export default function CreateInventoryItem() {
  const router = useRouter();
  const { data: measures, isLoading } = useSWR('/api/measures', fetcher);

  const [name, setName] = useState('');
  const [measureId, setMeasureId] = useState<MeasureId>('');
  const [amount, setAmount] = useState('');
  const [expiration, setExpiration] = useState('');
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Default to the first measure when none is explicitly chosen.
  const effectiveMeasureId = measureId || measures?.[0]?.measureId || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateInventoryItem = {
        name: name.trim(),
        measureId: effectiveMeasureId,
        amount: parseFloat(amount),
        expiration,
        ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
      };
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Failed to add item. Please try again.');
        return;
      }
      router.push('/inventory');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Metadata title="Add to Inventory" description="Add an item to your inventory" />

      <section>
        <h3 className="text-xl font-semibold mb-4">Add to Inventory</h3>
        <form onSubmit={handleSubmit} className="grid gap-2 max-w-sm">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Milk"
            className="p-2 text-base"
          />

          <label htmlFor="measure">Measure</label>
          {isLoading ? (
            <select id="measure" disabled>
              <option>Loading...</option>
            </select>
          ) : (
            <select
              id="measure"
              value={effectiveMeasureId}
              onChange={(e) => setMeasureId(e.target.value)}
              className="p-2 text-base"
            >
              {(measures ?? []).map((m) => (
                <option key={m.measureId} value={m.measureId}>
                  {m.plural}
                </option>
              ))}
            </select>
          )}

          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="e.g. 500"
            className="p-2 text-base"
          />

          <label htmlFor="expiration">Expiration date</label>
          <input
            id="expiration"
            type="date"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            required
            className="p-2 text-base"
          />

          <label htmlFor="barcode">Barcode (optional)</label>
          <input
            id="barcode"
            type="text"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 5012345678900"
            className="p-2 text-base"
          />

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={submitting || isLoading} className="mt-2">
            {submitting ? 'Saving...' : 'Add to inventory'}
          </button>
        </form>
      </section>
    </>
  );
}
