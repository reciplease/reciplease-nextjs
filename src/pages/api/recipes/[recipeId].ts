import type { NextApiRequest, NextApiResponse } from 'next';
import { backendFetch } from '@/lib/backend';
import { toMeasure } from '@/lib/measures';

type BackendRecipe = {
  recipeId: string;
  name: string;
  description: string | null;
  steps: string[] | null;
  ingredients: BackendIngredient[];
};

type BackendIngredient = {
  ingredientId: string;
  name: string;
  measure: string;
  amount: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Recipe>,
) {
  const { recipeId } = req.query;
  const response = await backendFetch(`/api/recipes/${recipeId}`);
  if (response.status === 404) {
    res.status(404).end();
    return;
  }
  if (!response.ok) {
    res.status(response.status).end();
    return;
  }
  const b: BackendRecipe = await response.json();
  const recipe: Recipe = {
    recipeId: b.recipeId,
    recipeShortId: '',
    name: b.name,
    description: b.description ?? null,
    steps: b.steps ?? [],
    ingredients: (b.ingredients ?? []).map((i) => ({
      ingredientId: i.ingredientId,
      name: i.name,
      measure: toMeasure(i.measure),
      amount: i.amount,
    })),
  };
  res.status(200).json(recipe);
}
