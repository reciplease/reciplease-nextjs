import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import styles from './Inventory.module.scss';

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

      <section className={styles.inventory}>
        <h3>Add to Inventory</h3>
        <form onSubmit={handleSubmit} className={styles.form}>
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
          />

          <label htmlFor="expiration">Expiration date</label>
          <input
            id="expiration"
            type="date"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            required
          />

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={submitting || isLoading}>
            {submitting ? 'Saving...' : 'Add to inventory'}
          </button>
        </form>
      </section>
    </>
  );
}
