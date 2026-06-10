import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures } from '@/lib/measures';
import { BackendRecipe, toRecipe } from '@/lib/recipes';

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
  return NextResponse.json(toRecipe(b, measures));
}

type UpdateRecipe = {
  name: string;
  description: string | null;
  steps: string[];
  ingredients: { name: string; measure: string; amount: number }[];
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;
  const body = (await request.json()) as UpdateRecipe;
  const response = await backendFetch(`/api/recipes/${recipeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId, ...body }),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const b: BackendRecipe = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(toRecipe(b, measures));
}
