import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';

const fetcher = (url: string): Promise<Ingredient[]> =>
  fetch(url).then((res) => res.json());

export default function CreateInventoryItem() {
  const router = useRouter();
  const { data: ingredients, isLoading } = useSWR('/api/ingredients', fetcher);

  const [ingredientUuid, setIngredientUuid] = useState('');
  const [amount, setAmount] = useState('');
  const [expiration, setExpiration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateInventoryItem = {
        ingredientUuid,
        amount: parseFloat(amount),
        expiration,
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
      <Metadata title="Add to Inventory" description="Add an ingredient to your inventory" />

      <section>
        <h3 className="text-xl font-semibold mb-4">Add to Inventory</h3>
        <form onSubmit={handleSubmit} className="grid gap-2 max-w-sm">
          <label htmlFor="ingredient">Ingredient</label>
          {isLoading ? (
            <select id="ingredient" disabled>
              <option>Loading...</option>
            </select>
          ) : (
            <select
              id="ingredient"
              value={ingredientUuid}
              onChange={(e) => setIngredientUuid(e.target.value)}
              required
              className="p-2 text-base"
            >
              <option value="" disabled>
                Select an ingredient
              </option>
              {(ingredients ?? []).map((ing) => (
                <option key={ing.uuid} value={ing.uuid}>
                  {ing.name}
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

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={submitting || isLoading} className="mt-2">
            {submitting ? 'Saving...' : 'Add to inventory'}
          </button>
        </form>
      </section>
    </>
  );
}
