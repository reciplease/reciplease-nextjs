import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import PlannedMealForm, { PlannedMealFormValues } from '@/components/PlannedMealForm';
import { planMeal } from '@/types/generated/client';
import { isSuccessResponse, describeErrorStatus } from '@/lib/apiClientMutator';

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

    const result = await planMeal({
      recipeId: values.recipeId || undefined,
      name: values.name,
      date: values.date,
      items,
    });
    if (!isSuccessResponse(result)) {
      // The generated mutator resolves rather than throws on an HTTP-level
      // error; result.data is an ErrorResponse for non-2xx responses (e.g.
      // "A meal named 'Dinner' is already planned for this date"), but we
      // don't have a more specific message to surface than the status-based
      // default here.
      return describeErrorStatus(result.status);
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
