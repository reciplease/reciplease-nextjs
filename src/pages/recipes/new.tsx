import { useActionState, useState } from 'react';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import RecipeForm, { type RecipeFormInitial, type RecipeFormValues } from '@/components/RecipeForm';
import { toRecipe, type BackendRecipe } from '@/lib/recipes';
import { apiFetch } from '@/lib/houses';

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
    const createRes = await apiFetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        steps: values.steps,
        isPublic: values.isPublic,
        sourceUrl: values.sourceUrl,
      }),
    });
    if (!createRes.ok) {
      return 'Failed to create recipe. Please try again.';
    }
    const backendRecipe: BackendRecipe = await createRes.json();
    const recipe = toRecipe(backendRecipe);

    // Ingredients attach one-by-one on the backend.
    for (const ingredient of values.ingredients) {
      const res = await apiFetch(`/api/recipes/${recipe.recipeId}/ingredients`, {
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
