import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;
  const response = await backendFetch(`/api/recipes/${recipeId}`);
  if (response.status === 404) {
    return new NextResponse(null, { status: 404 });
  }
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const b: BackendRecipe = await response.json();
  const measures = await fetchMeasures();
  const recipe: Recipe = {
    recipeId: b.recipeId,
    recipeShortId: '',
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
  return NextResponse.json(recipe);
}
