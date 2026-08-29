import { useActionState, useState } from 'react';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import RecipeForm, { type RecipeFormInitial, type RecipeFormValues } from '@/components/RecipeForm';
import { toRecipe } from '@/lib/recipes';
import { createRecipe, addRecipeIngredient, PublicRecipeOwned } from '@/types/generated/client';
import { isSuccessResponse, describeErrorStatus } from '@/lib/apiClientMutator';

export default function NewRecipe() {
  const router = useRouter();
  const [importUrl, setImportUrl] = useState('');
  const [formInitial, setFormInitial] = useState<RecipeFormInitial | undefined>(undefined);
  // Increment to remount RecipeForm when imported data replaces the blank form.
  const [formKey, setFormKey] = useState(0);

  const [importError, handleImport, importing] = useActionState(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return (body as { error?: string }).error ?? 'Failed to import. Please try again.';
      }
      const imported: RecipeFormInitial = await res.json();
      setFormInitial({ ...imported, sourceUrl: importUrl });
      setFormKey((k) => k + 1);
      return null;
    } catch {
      return 'Failed to import. Please check the URL and try again.';
    }
  }, null);

  async function handleSubmit(values: RecipeFormValues) {
    // createRecipe's generated body type is `NonReadonly<PublicRecipe>`, which
    // correctly excludes the readonly `recipeId`/`ingredients`/`updatedAt`
    // fields (verified against the generated utility types), but still
    // requires `owned` (a fixed "false" discriminant on PublicRecipe — see
    // PublicRecipeOwned). The backend ignores it on create (the discriminant
    // is server-computed), but the type requires it, so it's supplied here.
    // `description`/`sourceUrl` are non-nullable strings on PublicRecipe
    // (sourceUrl's pattern explicitly allows ''), while the form tracks them
    // as `string | null`, so null coalesces to ''.
    const createResponse = await createRecipe({
      name: values.name,
      description: values.description ?? '',
      steps: values.steps,
      isPublic: values.isPublic,
      sourceUrl: values.sourceUrl ?? '',
      owned: PublicRecipeOwned.false,
      // Ingredients attach one-by-one afterwards (see the loop below); the
      // generated body type still requires the field even though the
      // backend ignores it on create.
      ingredients: [],
    });
    if (!isSuccessResponse(createResponse)) {
      return describeErrorStatus(createResponse.status);
    }
    const recipe: Recipe = toRecipe(createResponse.data);

    // Ingredients attach one-by-one on the backend.
    for (const ingredient of values.ingredients) {
      const addResponse = await addRecipeIngredient(recipe.recipeId, {
        name: ingredient.name,
        measure: ingredient.measureId,
        amount: ingredient.amount,
      });
      if (!isSuccessResponse(addResponse)) {
        return 'Recipe saved, but some ingredients could not be added.';
      }
    }

    router.push(`/recipes/${recipe.recipeShortId}`);
  }

  return (
    <>
      <Metadata title="New Recipe" description="Create a new recipe" />

      <section className="grid gap-y-6">
        <form action={handleImport} className={`grid gap-2${formInitial?.sourceUrl ? ' hidden' : ''}`}>
          <label htmlFor="import-url" className="font-medium text-sm">
            Import from BBC Good Food or HelloFresh
          </label>
          <div className="flex gap-2">
            <input
              id="import-url"
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="Paste a recipe URL…"
              className="flex-1 p-2 text-base border border-[#ccc] rounded placeholder:text-[#999]"
            />
            <button
              type="submit"
              disabled={importing || !importUrl.trim()}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
          {importError && (
            <p role="alert" className="text-red-600 text-sm">
              {importError}
            </p>
          )}
        </form>

        <div className={`relative my-6 flex items-center gap-4${formInitial?.sourceUrl ? ' hidden' : ''}`}>
          <div className="flex-1 border-t border-[#333]" />
          <span className="text-sm text-[#666]">or</span>
          <div className="flex-1 border-t border-[#333]" />
        </div>

        <RecipeForm key={formKey} initial={formInitial} submitLabel="Save recipe" onSubmit={handleSubmit} />
      </section>
    </>
  );
}
