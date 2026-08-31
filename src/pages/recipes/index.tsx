import RecipePreview from '@/components/RecipePreview';
import Metadata from '@/components/Metadata';
import Recipe from '@/pages/recipes/[recipeId]';
import useSWR from 'swr';
import { fetchOrRedirect } from '@/lib/publicPageFetch';
import { toRecipe, type BackendRecipe } from '@/lib/recipes';
import { updateRecipe, PublicRecipeOwned } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';
import { useCallback } from 'react';

const fetcher = async (url: string): Promise<Recipe[]> => {
  const backendRecipes = await fetchOrRedirect<BackendRecipe[]>(url);
  return backendRecipes.map(toRecipe);
};

export default function Recipes() {
  const { data: recipes, error, isLoading, mutate } = useSWR(`/api/recipes`, fetcher);

  const toggleVisibility = useCallback(
    async (recipe: Recipe) => {
      const response = await updateRecipe(recipe.recipeId, {
        name: recipe.name,
        description: recipe.description ?? '',
        steps: recipe.steps,
        isPublic: !recipe.isPublic,
        sourceUrl: recipe.sourceUrl ?? '',
        owned: PublicRecipeOwned.false,
        ingredients: recipe.ingredients.map((ingredient) => ({
          name: ingredient.name,
          measure: ingredient.measure,
          amount: ingredient.amount,
        })),
      });
      if (isSuccessResponse(response)) {
        mutate();
      }
    },
    [mutate],
  );

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
        <ul className="my-8 flex list-none flex-col gap-3">
          {recipes.map((recipe, index) => (
            <li
              key={recipe.recipeId}
              className="fade-rise-in"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <RecipePreview
                recipe={recipe}
                onToggleVisibility={recipe.owned === 'true' ? toggleVisibility : undefined}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
