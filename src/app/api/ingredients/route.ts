import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';

type BackendIngredient = {
  uuid: string;
  name: string;
  measure: string;
};

function toIngredient(b: BackendIngredient, measures: Measure[]): Ingredient {
  return {
    uuid: b.uuid,
    name: b.name,
    measure: toMeasure(b.measure, measures),
  };
}

export async function GET() {
  const response = await backendFetch('/api/ingredients');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const backendIngredients: BackendIngredient[] = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(
    backendIngredients.map((b) => toIngredient(b, measures)),
  );
}

export async function POST(request: Request) {
  const { name, measureId } = (await request.json()) as CreateIngredient;
  const response = await backendFetch('/api/ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, measure: measureId }),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const b: BackendIngredient = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(toIngredient(b, measures), { status: 201 });
}
