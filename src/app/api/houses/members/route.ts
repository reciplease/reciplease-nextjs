import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function GET() {
  const response = await backendFetch('/api/houses/members');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
