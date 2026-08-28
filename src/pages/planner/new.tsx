import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import PlannedMealForm, { PlannedMealFormValues } from '@/components/PlannedMealForm';
import { apiFetch } from '@/lib/houses';

export default function NewPlannedMeal() {
  const router = useRouter();

  async function handleSubmit(values: PlannedMealFormValues) {
    const items = values.items.map((item) => ({
      ingredient: {
        name: item.name,
        measure: item.measureId,
        amount: item.amount,
      },
      allocations: item.pantryItemId
        ? [{ pantryItemId: item.pantryItemId, amount: item.allocationAmount ?? item.amount }]
        : [],
    }));

    const res = await apiFetch('/api/planned-meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: values.recipeId || undefined,
        name: values.name,
        date: values.date,
        items,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return (body as { message?: string }).message ?? 'Failed to plan meal. Please try again.';
    }

    router.push('/planner');
  }

  return (
    <>
      <Metadata title="Plan a Meal" description="Plan when you'll eat something" />

      <section className="grid gap-6">
        <h3 className="text-xl font-semibold">Plan a meal</h3>

        <PlannedMealForm submitLabel="Plan meal" onSubmit={handleSubmit} />
      </section>
    </>
  );
}
