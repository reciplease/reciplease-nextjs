import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

type AddIngredient = {
  name: string;
  measure: string;
  amount: number;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;
  const body = (await request.json()) as AddIngredient;
  const response = await backendFetch(`/api/recipes/${recipeId}/ingredients`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json(), { status: 201 });
}
