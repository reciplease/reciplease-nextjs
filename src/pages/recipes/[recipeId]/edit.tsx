import { useState } from 'react';
import Metadata from '@/components/Metadata';
import RecipeForm, { RecipeFormValues } from '@/components/RecipeForm';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { full } from '@/lib/recipe-id';
import { useActiveHouse, apiFetch } from '@/lib/houses';
import { toRecipe, type BackendRecipe } from '@/lib/recipes';

const fetcher = async (url: string): Promise<Recipe> => {
  const backendRecipe: BackendRecipe = await apiFetch(url).then((res) => res.json());
  return toRecipe(backendRecipe);
};

export default function EditRecipe() {
  const router = useRouter();
  const recipeShortId = router.query.recipeId as RecipeShortId | undefined;
  const recipeId = recipeShortId ? full(recipeShortId) : undefined;
  const {
    data: recipe,
    error,
    isLoading,
  } = useSWR(recipeId ? `/api/recipes/${recipeId}` : null, fetcher);
  const activeHouse = useActiveHouse();
  const editable =
    !!recipe?.houseId &&
    activeHouse?.role === 'OWNER' &&
    activeHouse.id === recipe.houseId;

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${recipe.name}"? This can't be undone.`)) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
      if (!res.ok) {
        setDeleteError('Failed to delete recipe. Please try again.');
        return;
      }
      router.push('/recipes');
    } catch {
      setDeleteError('An unexpected error occurred.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(values: RecipeFormValues) {
    const res = await apiFetch(`/api/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        steps: values.steps,
        isPublic: values.isPublic,
        sourceUrl: values.sourceUrl,
        ingredients: values.ingredients.map((ingredient) => ({
          name: ingredient.name,
          measure: ingredient.measureId,
          amount: ingredient.amount,
        })),
      }),
    });
    if (!res.ok) {
      return 'Failed to save changes. Please try again.';
    }

    router.push(`/recipes/${recipeShortId}`);
  }

  if (!router.isReady || isLoading) {
    return (
      <>
        <Metadata title="Loading Recipe" description="Loading recipe..." />

        <section>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !recipe) {
    return (
      <>
        <Metadata title="No Recipe Found" description="No recipe found" />

        <section>
          <p>No recipe found</p>
        </section>
      </>
    );
  }

  if (!editable) {
    return (
      <>
        <Metadata title="Not Authorized" description="You cannot edit this recipe" />

        <section>
          <p>You do not have permission to edit this recipe.</p>
          <Link href={`/recipes/${recipeShortId}`}>Back to recipe</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={`Edit ${recipe.name}`} description="Edit recipe" />

      <section>
        {deleteError && <p role="alert" className="mb-2 text-red-600">{deleteError}</p>}
        <RecipeForm
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          initial={{
            name: recipe.name,
            description: recipe.description,
            steps: recipe.steps,
            isPublic: recipe.isPublic,
            sourceUrl: recipe.sourceUrl,
            ingredients: recipe.ingredients.map((ingredient) => ({
              name: ingredient.name,
              measureId: ingredient.measure,
              amount: ingredient.amount,
            })),
          }}
        />
      </section>
    </>
  );
}
