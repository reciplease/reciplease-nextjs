import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

// Redeeming requires only a valid Google sign-in (not yet allowlisted) — backendFetch
// attaches whatever bearer token the current session has.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const response = await backendFetch(`/api/invites/${code}/accept`, { method: 'POST' });
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
