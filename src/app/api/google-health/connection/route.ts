import { NextResponse } from 'next/server';
import { BACKEND_URL, accessToken } from '@/lib/backend';

// Dedicated route for /api/google-health/connection — NOT covered by the
// generic [...proxy] catch-all (see src/app/api/[...proxy]/route.ts) because
// the backend's GET response carries the raw Google refresh token, which must
// NEVER reach browser JS. This route strips it before responding.

export async function GET() {
  const token = await accessToken();
  if (!token) {
    return NextResponse.json({ connected: false });
  }

  const response = await fetch(`${BACKEND_URL}/api/google-health/connection`, {
    method: 'GET',
    headers: { cookie: `reciplease-session=${token}` },
  });
  if (!response.ok) {
    return NextResponse.json({ connected: false });
  }

  const body: { connected: boolean } = await response.json();
  // Deliberately only forward `connected` — the backend body also includes
  // `expiresAt`/`refreshToken`, which must never reach the client.
  return NextResponse.json({ connected: body.connected });
}

export async function DELETE() {
  const token = await accessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = await fetch(`${BACKEND_URL}/api/google-health/connection`, {
    method: 'DELETE',
    headers: { cookie: `reciplease-session=${token}` },
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
}
