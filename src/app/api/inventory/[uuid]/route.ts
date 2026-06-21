import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';
import { fetchMeasureById } from '@/lib/measures';

type BackendInventoryItem = {
  uuid: string;
  name: string;
  measure: string;
  amount: number;
  expiration: string;
  barcode?: string | null;
  image?: string | null;
  updatedAt?: string;
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
    name: b.name,
    measure: await fetchMeasureById(b.measure),
    amount: b.amount,
    expiration: b.expiration,
    ...(b.barcode ? { barcode: b.barcode } : {}),
    ...(b.image ? { image: b.image } : {}),
    ...(b.updatedAt ? { updatedAt: b.updatedAt } : {}),
  } satisfies InventoryItem);
}
