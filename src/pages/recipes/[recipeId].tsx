import Metadata from '@/components/Metadata';
import styles from '@/pages/recipes/Recipe.module.scss';
import { GetServerSidePropsContext } from 'next';
import useSWR from 'swr';
import { full } from '@/pages/api/short-uuid';

const fetcher = (url: string): Promise<Recipe> =>
  fetch(url).then((res) => res.json());

interface Props {
  recipeShortId: string;
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
        <h3>Recipe: {recipe.name}</h3>
        <p>{recipe.description}</p>
        <h4>Ingredients</h4>
        <ul>
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.ingredientId}>
              {ingredient.name}
              {' - '}
              {displayMeasure(ingredient.measure, ingredient.amount)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function displayMeasure(measure: Measure, amount: number) {
  return `${amount} ${displayMeasureWord(measure, amount)}`;
}

function displayMeasureWord(measure: Measure, amount: number) {
  if (amount == 1) return measure.singular;
  return measure.plural;
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { recipeShortId: context.params?.recipeId },
  };
}
