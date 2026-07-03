import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, accessToken } from '@/lib/backend';
import { ensureFreshGoogleHealthConnection } from '@/lib/googleHealthTokens';

// Dedicated route rather than falling through to the generic [...proxy]
// catch-all: the backend no longer auto-refreshes an expired Google access
// token before calling Google's API, so this app must proactively ensure the
// stored token is fresh first.
export async function GET(req: NextRequest) {
  const token = await accessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureFreshGoogleHealthConnection(token);

  const query = req.nextUrl.searchParams.get('query') ?? '';
  const url = new URL(`${BACKEND_URL}/api/google-health/foods/search`);
  url.searchParams.set('query', query);

  const response = await fetch(url, {
    method: 'GET',
    headers: { cookie: `reciplease-session=${token}` },
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
}
