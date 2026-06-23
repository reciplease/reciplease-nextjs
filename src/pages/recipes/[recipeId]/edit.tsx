import Metadata from '@/components/Metadata';
import RecipeForm, { RecipeFormValues } from '@/components/RecipeForm';
import { GetServerSidePropsContext } from 'next';
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

interface Props {
  recipeShortId: RecipeShortId;
}

export default function EditRecipe({ recipeShortId }: Props) {
  const router = useRouter();
  const recipeId = full(recipeShortId);
  const {
    data: recipe,
    error,
    isLoading,
  } = useSWR(`/api/recipes/${recipeId}`, fetcher);
  const activeHouse = useActiveHouse();
  const editable =
    !!recipe?.houseId &&
    activeHouse?.role === 'OWNER' &&
    activeHouse.id === recipe.houseId;

  async function handleSubmit(values: RecipeFormValues) {
    const res = await apiFetch(`/api/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        steps: values.steps,
        isPublic: values.isPublic,
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

  if (isLoading) {
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
        <RecipeForm
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          initial={{
            name: recipe.name,
            description: recipe.description,
            steps: recipe.steps,
            isPublic: recipe.isPublic,
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

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { recipeShortId: context.params?.recipeId },
  };
}
