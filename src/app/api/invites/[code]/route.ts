import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

// Invite preview: no auth required on the backend, so the landing page can show
// "you're invited to X" before the user signs in.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const response = await backendFetch(`/api/invites/${code}`);
  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
