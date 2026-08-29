import { useActionState } from 'react';
import Metadata from '@/components/Metadata';
import RecipeForm, { RecipeFormValues } from '@/components/RecipeForm';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { full } from '@/lib/recipe-id';
import { useActiveHouse } from '@/lib/houses';
import { toRecipe } from '@/lib/recipes';
import { useFindRecipeById, deleteRecipeById, updateRecipe, PublicRecipeOwned } from '@/types/generated/client';
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
  const activeHouse = useActiveHouse();
  const editable =
    recipe?.owned === 'true' &&
    activeHouse?.role === 'OWNER' &&
    activeHouse.id === recipe.houseId;

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
    // The backend's `ingredients` field is no longer marked `readOnly` on
    // `PublicRecipe`, so `NonReadonly<PublicRecipe>` now includes it and this
    // payload satisfies the generated body type directly, with no cast needed.
    // `description`/`sourceUrl` are non-nullable strings on PublicRecipe
    // (sourceUrl's pattern explicitly allows ''), while the form tracks them
    // as `string | null`, so null coalesces to ''. `owned` is a fixed "false"
    // discriminant on PublicRecipe (see PublicRecipeOwned); the backend
    // ignores it on update, but the type requires it.
    const result = await updateRecipe(recipeId as string, {
      name: values.name,
      description: values.description ?? '',
      steps: values.steps,
      isPublic: values.isPublic,
      sourceUrl: values.sourceUrl ?? '',
      owned: PublicRecipeOwned.false,
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
          <p>Loading...</p>
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
            steps: recipe.steps,
            isPublic: recipe.isPublic ?? false,
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
