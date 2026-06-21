import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import RecipeForm, { RecipeFormValues } from '@/components/RecipeForm';

export default function NewRecipe() {
  const router = useRouter();

  async function handleSubmit(values: RecipeFormValues) {
    const createRes = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        steps: values.steps,
        isPublic: values.isPublic,
      }),
    });
    if (!createRes.ok) {
      return 'Failed to create recipe. Please try again.';
    }
    const recipe: Recipe = await createRes.json();

    // Ingredients attach one-by-one on the backend.
    for (const ingredient of values.ingredients) {
      const res = await fetch(`/api/recipes/${recipe.recipeId}/ingredients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ingredient.name,
          measure: ingredient.measureId,
          amount: ingredient.amount,
        }),
      });
      if (!res.ok) {
        return 'Recipe saved, but some ingredients could not be added.';
      }
    }

    router.push(`/recipes/${recipe.recipeShortId}`);
  }

  return (
    <>
      <Metadata title="New Recipe" description="Create a new recipe" />

      <section>
        <RecipeForm submitLabel="Save recipe" onSubmit={handleSubmit} />
      </section>
    </>
  );
}
