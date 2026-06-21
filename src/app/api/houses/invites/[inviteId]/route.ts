import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const { inviteId } = await params;
  const response = await backendFetch(`/api/houses/invites/${inviteId}`, { method: 'DELETE' });
  return new NextResponse(null, { status: response.status });
}
