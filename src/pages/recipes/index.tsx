import styles from '@/pages/recipes/Recipes.module.scss';
import RecipePreview from '@/components/RecipePreview';
import Metadata from '@/components/Metadata';
import Recipe from '@/pages/recipes/[recipeId]';
import useSWR from 'swr';

const fetcher = (url: string): Promise<Recipe[]> =>
  fetch(url).then((res) => res.json());

export default function Recipes() {
  const { data: recipes, error, isLoading } = useSWR(`/api/recipes`, fetcher);

  if (isLoading) {
    return (
      <>
        <Metadata
          title={'Loading Recipes'}
          description={'Loading recipes...'}
        />

        <section className={styles.recipes}>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !recipes) {
    return (
      <>
        <Metadata title={'No Recipes Found'} description={'No recipes found'} />

        <section className={styles.recipes}>
          <p>No recipes found</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={'Recipes'} description={'View recipes'} />

      <section className={styles.recipes}>
        <h3 className={styles.recipes_title}>Recipes</h3>
        <ul className={styles.previews}>
          {recipes.map((recipe) => (
            <li key={recipe.recipeId}>
              <RecipePreview recipe={recipe} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
