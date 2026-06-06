import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';
import { shorten } from '@/lib/recipe-id';

type BackendRecipe = {
  recipeId: string;
  name: string;
  description: string | null;
  steps: string[] | null;
  ingredients: BackendIngredient[];
};

type BackendIngredient = {
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
      name: i.name,
      measure: toMeasure(i.measure, measures),
      amount: i.amount,
    })),
  };
}

export async function GET() {
  const response = await backendFetch('/api/recipes');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const backendRecipes: BackendRecipe[] = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(backendRecipes.map((b) => toRecipe(b, measures)));
}

type CreateRecipe = {
  name: string;
  description: string | null;
  steps: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateRecipe;
  const response = await backendFetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const b: BackendRecipe = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(toRecipe(b, measures), { status: 201 });
}
