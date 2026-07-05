import { useState } from 'react';
import Metadata from '@/components/Metadata';
import PlannedMealForm, { PlannedMealFormValues } from '@/components/PlannedMealForm';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { full } from '@/lib/recipe-id';
import { useActiveHouse, apiFetch } from '@/lib/houses';
import { toPlannedMeal, type BackendPlannedMeal } from '@/lib/plannedMeals';

const fetcher = async (url: string): Promise<PlannedMeal> => {
  const backendMeal: BackendPlannedMeal = await apiFetch(url).then((res) => res.json());
  return toPlannedMeal(backendMeal);
};

export default function EditPlannedMeal() {
  const router = useRouter();
  const plannedMealShortId = router.query.plannedMealId as PlannedMealShortId | undefined;
  const plannedMealId = plannedMealShortId ? full(plannedMealShortId) : undefined;
  const {
    data: meal,
    error,
    isLoading,
  } = useSWR(plannedMealId ? `/api/planned-meals/${plannedMealId}` : null, fetcher);
  const activeHouse = useActiveHouse();
  const editable =
    !!meal &&
    activeHouse?.role === 'OWNER' &&
    activeHouse.id === meal.houseId;

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${meal?.name}"? This can't be undone.`)) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/planned-meals/${plannedMealId}`, { method: 'DELETE' });
      if (!res.ok) {
        setDeleteError('Failed to delete meal. Please try again.');
        return;
      }
      router.push('/planner');
    } catch {
      setDeleteError('An unexpected error occurred.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(values: PlannedMealFormValues) {
    const items = values.items.map((item) => ({
      ingredient: {
        name: item.name,
        measure: item.measureId,
        amount: item.amount,
      },
      allocations: item.inventoryItemId
        ? [{ inventoryItemId: item.inventoryItemId, amount: item.allocationAmount ?? item.amount }]
        : [],
    }));

    const res = await apiFetch(`/api/planned-meals/${plannedMealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: values.recipeId || undefined,
        name: values.name,
        date: values.date,
        items,
      }),
    });

    if (!res.ok) {
      return 'Failed to save changes. Please try again.';
    }

    router.push('/planner');
  }

  if (!router.isReady || isLoading) {
    return (
      <>
        <Metadata title="Loading Meal" description="Loading planned meal..." />

        <section>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !meal) {
    return (
      <>
        <Metadata title="No Meal Found" description="No planned meal found" />

        <section>
          <p>No planned meal found</p>
        </section>
      </>
    );
  }

  if (!editable) {
    return (
      <>
        <Metadata title="Not Authorized" description="You cannot edit this meal" />

        <section>
          <p>You do not have permission to edit this meal.</p>
          <Link href="/planner">Back to planner</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={`Edit ${meal.name}`} description="Edit planned meal" />

      <section className="grid gap-6">
        <h3 className="text-xl font-semibold">Edit meal</h3>

        {deleteError && <p role="alert" className="text-red-600">{deleteError}</p>}
        <PlannedMealForm
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          initial={{
            name: meal.name,
            date: meal.date,
            recipeId: meal.recipe?.recipeId ?? '',
            items: meal.items.map((item) => ({
              name: item.ingredient.name,
              measureId: item.ingredient.measure,
              amount: item.ingredient.amount,
              inventoryItemId: item.allocations[0]?.inventoryItemId,
              allocationAmount: item.allocations[0]?.amount,
            })),
          }}
        />
      </section>
    </>
  );
}
