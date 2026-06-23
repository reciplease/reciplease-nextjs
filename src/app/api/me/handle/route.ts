import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function POST(request: Request) {
  const body = await request.json();
  const response = await backendFetch('/api/me/handle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  const me = await response.json();
  return NextResponse.json(me);
}
