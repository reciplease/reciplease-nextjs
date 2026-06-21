import Metadata from '@/components/Metadata';
import { GetServerSidePropsContext } from 'next';
import Link from 'next/link';
import useSWR from 'swr';
import { full } from '@/lib/recipe-id';
import { formatTimestamp } from '@/lib/formatDate';
import { useActiveHouse } from '@/lib/houses';

const fetcher = (url: string): Promise<Recipe> =>
  fetch(url).then((res) => res.json());

interface Props {
  recipeShortId: RecipeShortId;
}

export default function Recipe({ recipeShortId }: Props) {
  const recipeId = full(recipeShortId);
  const {
    data: recipe,
    error,
    isLoading,
  } = useSWR(`/api/recipes/${recipeId}`, fetcher);
  const activeHouse = useActiveHouse();
  // Editable only if the caller owns the house this recipe actually belongs
  // to — being an OWNER elsewhere doesn't grant edit rights on someone else's
  // (possibly public) recipe.
  const editable =
    !!recipe?.houseId &&
    activeHouse?.role === 'OWNER' &&
    activeHouse.id === recipe.houseId;

  if (isLoading) {
    return (
      <>
        <Metadata title={'Loading Recipe'} description={'Loading recipe...'} />

        <section>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !recipe) {
    return (
      <>
        <Metadata title={'No Recipe Found'} description={'No recipe found'} />

        <section>
          <p>No recipe found</p>
          {error && <p>{JSON.stringify(error)}</p>}
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={`${recipe.name}`} description={'View recipe'} />

      <section>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold">{recipe.name}</h2>
          {editable && (
            <Link
              href={`/recipes/${recipeShortId}/edit`}
              className="w-fit shrink-0 rounded border-2 border-secondary px-2 py-1 text-sm whitespace-nowrap"
            >
              Edit
            </Link>
          )}
        </div>
        {recipe.updatedAt && (
          <p className="text-sm text-[#666]">
            Last updated: {formatTimestamp(recipe.updatedAt)}
          </p>
        )}
        <p className="my-4">{recipe.description}</p>
        <h4 className="mt-12">Ingredients</h4>
        <ul className="ms-16 list-disc">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index} className="my-4">
              {displayIngredient(ingredient)}
            </li>
          ))}
        </ul>
        <h4 className="mt-12">Method</h4>
        <ol className="ms-16 list-decimal">
          {recipe.steps.map((step, index) => (
            <li key={index} className="my-4">{step}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

function displayIngredient(ingredient: RecipeIngredient) {
  return `${ingredient.name} - ${ingredient.amount} ${displayMeasure(
    ingredient,
  )}`;
}

function displayMeasure(ingredient: RecipeIngredient) {
  if (ingredient.amount == 1) return ingredient.measure.singular;
  return ingredient.measure.plural;
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { recipeShortId: context.params?.recipeId },
  };
}
