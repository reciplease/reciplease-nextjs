import Metadata from '@/components/Metadata';
import styles from '@/pages/recipes/Recipe.module.scss';
import { GetServerSidePropsContext } from 'next';
import useSWR from 'swr';
import { full } from '@/pages/api/recipes/data';

const fetcher = (url: string): Promise<Recipe> =>
  fetch(url).then((res) => res.json());

interface Props {
  recipeShortId: RecipeShortId;
}

export default function Recipe({ recipeShortId }: Props) {
  const recipeId = full(recipeShortId);
  const { data: recipe, error } = useSWR(`/api/recipes/${recipeId}`, fetcher);

  if (error || !recipe) {
    return (
      <>
        <Metadata title={'No Recipe Found'} description={'No recipe found'} />

        <section className={styles.recipe}>
          <p>No recipe found</p>
          {error && <p>{JSON.stringify(error)}</p>}
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={`${recipe.name}`} description={'View recipe'} />

      <section className={styles.recipe}>
        <h3>{recipe.name}</h3>
        <p>{recipe.description}</p>
        <h4>Ingredients</h4>
        <ul>
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.ingredientId}>
              {displayIngredient(ingredient)}
            </li>
          ))}
        </ul>
        <h4>Preparation</h4>
        <ol>
          {recipe.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

function displayIngredient(ingredient: Ingredient) {
  return `${ingredient.name} - ${ingredient.amount} ${displayMeasure(
    ingredient
  )}`;
}

function displayMeasure(ingredient: Ingredient) {
  if (ingredient.amount == 1) return ingredient.measure.singular;
  return ingredient.measure.plural;
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { recipeShortId: context.params?.recipeId },
  };
}
