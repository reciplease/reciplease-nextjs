import type { NextApiRequest, NextApiResponse } from 'next';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';
import { shorten } from './data';

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

function toRecipe(b: BackendRecipe, measures: Measure[]): Recipe {
  return {
    recipeId: b.recipeId,
    recipeShortId: shorten(b.recipeId),
    name: b.name,
    description: b.description ?? null,
    steps: b.steps ?? [],
    ingredients: (b.ingredients ?? []).map((i) => ({
      ingredientId: i.ingredientId,
      name: i.name,
      measure: toMeasure(i.measure, measures),
      amount: i.amount,
    })),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Recipe[]>,
) {
  const response = await backendFetch('/api/recipes');
  if (!response.ok) {
    res.status(response.status).end();
    return;
  }
  const backendRecipes: BackendRecipe[] = await response.json();
  const measures = await fetchMeasures();
  res.status(200).json(backendRecipes.map((b) => toRecipe(b, measures)));
}
