import { useActionState } from 'react';
import Metadata from '@/components/Metadata';
import LoadingBox from '@/components/LoadingBox';
import RecipeForm, { RecipeFormValues } from '@/components/RecipeForm';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { full } from '@/lib/recipe-id';
import { toRecipe } from '@/lib/recipes';
import { useFindRecipeById, deleteRecipeById, updateRecipe } from '@/types/generated/client';
import { isSuccessResponse, describeErrorStatus } from '@/lib/apiClientMutator';

export default function EditRecipe() {
  const router = useRouter();
  const recipeShortId = router.query.recipeId as RecipeShortId | undefined;
  const recipeId = recipeShortId ? full(recipeShortId) : undefined;
  const {
    data: recipeResponse,
    error,
    isLoading,
  } = useFindRecipeById(recipeId as string, {
    swr: { enabled: Boolean(recipeId) },
  });
  const recipe = recipeResponse && isSuccessResponse(recipeResponse) ? toRecipe(recipeResponse.data) : undefined;
  const recipeError = error || (recipeResponse && !isSuccessResponse(recipeResponse));
  const editable = Boolean(recipe?.ownership);

  const [deleteError, handleDelete, deleting] = useActionState(async (): Promise<string | null> => {
    if (!window.confirm(`Delete "${recipe?.name}"? This can't be undone.`)) return null;
    const result = await deleteRecipeById(recipeId as string);
    if (!isSuccessResponse(result)) {
      return describeErrorStatus(result.status);
    }
    router.push('/recipes');
    return null;
  }, null);

  async function handleSubmit(values: RecipeFormValues) {
    const result = await updateRecipe(recipeId as string, {
      name: values.name,
      description: values.description ?? '',
      method: values.method,
      isPublic: values.isPublic,
      sourceUrl: values.sourceUrl ?? '',
      prepTimeMinutes: values.prepTimeMinutes ?? undefined,
      cookTimeMinutes: values.cookTimeMinutes ?? undefined,
      servings: values.servings ?? undefined,
      ingredients: values.ingredients.map((ingredient) => ({
        name: ingredient.name,
        measure: ingredient.measureId,
        amount: ingredient.amount,
      })),
    });
    if (!isSuccessResponse(result)) {
      return describeErrorStatus(result.status);
    }

    router.push(`/recipes/${recipeShortId}`);
  }

  if (!router.isReady || isLoading) {
    return (
      <>
        <Metadata title="Loading Recipe" description="Loading recipe..." />

        <section>
          <LoadingBox label="Loading..." className="min-h-64" />
        </section>
      </>
    );
  }

  if (recipeError || !recipe) {
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
            method: recipe.method,
            isPublic: recipe.isPublic ?? false,
            sourceUrl: recipe.sourceUrl,
            prepTimeMinutes: recipe.prepTimeMinutes,
            cookTimeMinutes: recipe.cookTimeMinutes,
            servings: recipe.servings,
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
