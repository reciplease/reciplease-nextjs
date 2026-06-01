import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import styles from './Ingredients.module.scss';

const fetcher = (url: string): Promise<Measure[]> =>
  fetch(url).then((res) => res.json());

export default function CreateIngredient() {
  const router = useRouter();
  const { data: measures } = useSWR('/api/measures', fetcher);
  const [name, setName] = useState('');
  const [measureId, setMeasureId] = useState<MeasureId>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (measures && measures.length > 0 && !measureId) {
      setMeasureId(measures[0].measureId);
    }
  }, [measures, measureId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, measureId } satisfies CreateIngredient),
      });
      if (!res.ok) {
        setError('Failed to create ingredient. Please try again.');
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
      <Metadata title="Add Ingredient" description="Create a new ingredient" />

      <section className={styles.form_page}>
        <h3>Add Ingredient</h3>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Milk"
          />

          <label htmlFor="measure">Measure</label>
          <select
            id="measure"
            value={measureId}
            onChange={(e) => setMeasureId(e.target.value)}
          >
            {(measures ?? []).map((m) => (
              <option key={m.measureId} value={m.measureId}>
                {m.plural}
              </option>
            ))}
          </select>

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save ingredient'}
          </button>
        </form>
      </section>
    </>
  );
}
