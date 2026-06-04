import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';

type BackendIngredient = {
  uuid: string;
  name: string;
  measure: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) {
    return NextResponse.json([]);
  }
  const response = await backendFetch(`/api/ingredients/search/${encodeURIComponent(q)}`);
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const backendIngredients: BackendIngredient[] = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(
    backendIngredients.map((b) => ({
      uuid: b.uuid,
      name: b.name,
      measure: toMeasure(b.measure, measures),
    })),
  );
}
