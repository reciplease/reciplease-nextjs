import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import { allMeasures } from '@/lib/measures';
import styles from './Ingredients.module.scss';

export default function CreateIngredient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [measureId, setMeasureId] = useState<MeasureId>(allMeasures[0].measureId);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
            {allMeasures.map((m) => (
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
