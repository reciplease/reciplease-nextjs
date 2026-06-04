import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function GET() {
  const response = await backendFetch('/api/measures');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const measures: Measure[] = await response.json();
  return NextResponse.json(measures);
}

export async function POST(request: NextRequest) {
  const { singular, plural } = (await request.json()) as { singular: string; plural: string };
  const response = await backendFetch('/api/measures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ singular, plural }),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const measure: Measure = await response.json();
  return NextResponse.json(measure, { status: 201 });
}
