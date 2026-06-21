import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function GET() {
  const response = await backendFetch('/api/houses/invites');
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json());
}

export async function POST(request: Request) {
  const body = await request.text();
  const response = await backendFetch('/api/houses/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json(), { status: response.status });
}
