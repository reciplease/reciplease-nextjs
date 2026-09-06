import { useActionState } from 'react';
import Metadata from '@/components/Metadata';
import LoadingBox from '@/components/LoadingBox';
import PlannedMealForm, { PlannedMealFormValues } from '@/components/PlannedMealForm';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { full } from '@/lib/recipe-id';
import { useActiveHouse } from '@/lib/houses';
import { toPlannedMeal, type BackendPlannedMeal } from '@/lib/plannedMeals';
import { useFindPlannedMealById, deletePlannedMealById, updatePlannedMeal } from '@/types/generated/client';
import { isSuccessResponse, describeErrorStatus } from '@/lib/apiClientMutator';

export default function EditPlannedMeal() {
  const router = useRouter();
  const plannedMealShortId = router.query.plannedMealId as PlannedMealShortId | undefined;
  const plannedMealId = plannedMealShortId ? full(plannedMealShortId) : undefined;
  const {
    data: mealResponse,
    error,
    isLoading,
  } = useFindPlannedMealById(plannedMealId as string, {
    swr: { enabled: Boolean(plannedMealId) },
  });
  const meal = mealResponse && isSuccessResponse(mealResponse) ? toPlannedMeal(mealResponse.data as BackendPlannedMeal) : undefined;
  const mealError = error || (mealResponse && !isSuccessResponse(mealResponse));
  const activeHouse = useActiveHouse();
  const editable =
    !!meal &&
    activeHouse?.role === 'OWNER' &&
    activeHouse.id === meal.houseId;

  const [deleteError, handleDelete, deleting] = useActionState(async (): Promise<string | null> => {
    if (!window.confirm(`Delete "${meal?.name}"? This can't be undone.`)) return null;
    const result = await deletePlannedMealById(plannedMealId as string);
    if (!isSuccessResponse(result)) {
      return describeErrorStatus(result.status);
    }
    router.push('/planner');
    return null;
  }, null);

  async function handleSubmit(values: PlannedMealFormValues) {
    const items = values.items.map((item) => ({
      ingredient: {
        name: item.name,
        measure: item.measureId,
        amount: item.amount,
      },
      allocations: item.allocations,
    }));

    const result = await updatePlannedMeal(plannedMealId as string, {
      recipeId: values.recipeId || undefined,
      name: values.name,
      date: values.date,
      items,
    });
    if (!isSuccessResponse(result)) {
      return describeErrorStatus(result.status);
    }

    router.push('/planner');
  }

  if (!router.isReady || isLoading) {
    return (
      <>
        <Metadata title="Loading Meal" description="Loading planned meal..." />

        <section>
          <LoadingBox label="Loading..." className="min-h-64" />
        </section>
      </>
    );
  }

  if (mealError || !meal) {
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
          excludeMealId={plannedMealId}
          initial={{
            name: meal.name,
            date: meal.date,
            recipeId: meal.recipe?.recipeId ?? '',
            items: meal.items.map((item) => ({
              name: item.ingredient.name,
              measureId: item.ingredient.measure,
              amount: item.ingredient.amount,
              allocations: item.allocations.map((allocation) => ({
                pantryItemId: allocation.pantryItemId,
                amount: allocation.amount,
              })),
            })),
          }}
        />
      </section>
    </>
  );
}
