import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasureById } from '@/lib/measures';

type BackendInventoryItem = {
  uuid: string;
  ingredientUuid: string;
  name: string;
  measure: string;
  amount: number;
  expiration: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;
  const response = await backendFetch(`/api/inventory/${uuid}`);
  if (response.status === 404) {
    return new NextResponse(null, { status: 404 });
  }
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const b: BackendInventoryItem = await response.json();
  return NextResponse.json({
    uuid: b.uuid,
    ingredientUuid: b.ingredientUuid,
    name: b.name,
    measure: await fetchMeasureById(b.measure),
    amount: b.amount,
    expiration: b.expiration,
  } satisfies InventoryItem);
}
