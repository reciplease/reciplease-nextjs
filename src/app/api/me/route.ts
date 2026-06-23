import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function GET() {
  const response = await backendFetch('/api/me');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const me = await response.json();
  return NextResponse.json(me);
}
