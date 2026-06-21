import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const body = await request.text();
  const response = await backendFetch(`/api/houses/members/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
