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

        <section className="grid">
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !recipes) {
    return (
      <>
        <Metadata title={'No Recipes Found'} description={'No recipes found'} />

        <section className="grid">
          <p>No recipes found</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={'Recipes'} description={'View recipes'} />

      <section className="grid">
        <ul className="my-8 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {recipes.map((recipe, index) => (
            <li
              key={recipe.recipeId}
              className="fade-rise-in"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <RecipePreview recipe={recipe} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
