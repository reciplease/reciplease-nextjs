import Metadata from '@/components/Metadata';
import styles from '@/pages/recipes/Recipe.module.scss';
import { GetServerSidePropsContext } from 'next';
import useSWR from 'swr';

const fetcher = (url: string): Promise<Recipe> =>
  fetch(url).then((res) => res.json());

interface Props {
  recipeId: string;
}

export default function Recipe({ recipeId }: Props) {
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
              {ingredient.amount} {ingredient.measure.toLowerCase()}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { recipeId: context.params?.recipeId },
  };
}
