import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures } from '@/lib/measures';
import { BackendRecipe, toRecipe } from '@/lib/recipes';

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
  isPublic: boolean;
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
