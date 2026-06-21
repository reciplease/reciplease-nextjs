import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';

type BackendInventoryItem = {
  uuid: string;
  name: string;
  measure: string;
  amount: number;
  expiration: string;
  barcode?: string | null;
  image?: string | null;
};

function toInventoryItem(
  b: BackendInventoryItem,
  measures: Measure[],
): InventoryItem {
  return {
    uuid: b.uuid,
    name: b.name,
    measure: toMeasure(b.measure, measures),
    amount: b.amount,
    expiration: b.expiration,
    ...(b.barcode ? { barcode: b.barcode } : {}),
    ...(b.image ? { image: b.image } : {}),
  };
}

export async function GET() {
  const response = await backendFetch('/api/inventory');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const items: BackendInventoryItem[] = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(items.map((b) => toInventoryItem(b, measures)));
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateInventoryItem;
  // The backend stores the measure as its slug, so map measureId -> measure.
  const response = await backendFetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      measure: body.measureId,
      amount: body.amount,
      expiration: body.expiration,
      ...(body.barcode ? { barcode: body.barcode } : {}),
      ...(body.image ? { image: body.image } : {}),
    }),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const b: BackendInventoryItem = await response.json();
  const measures = await fetchMeasures();
  return NextResponse.json(toInventoryItem(b, measures), { status: 201 });
}
