import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function GET() {
  const response = await backendFetch('/api/measures');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const measures: Measure[] = await response.json();
  return NextResponse.json(measures);
}
