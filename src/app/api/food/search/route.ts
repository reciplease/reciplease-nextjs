import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, accessToken } from '@/lib/backend';
import { ensureFreshGoogleHealthConnection } from '@/lib/googleHealthTokens';

// Dedicated route rather than falling through to the generic [...proxy]
// catch-all: the history half of this search depends on a fresh Google Health
// access token, so this app must proactively ensure it's fresh first (a
// no-op when Google Health isn't linked — the backend's catalog-only results
// still come back either way).
export async function GET(req: NextRequest) {
  const token = await accessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureFreshGoogleHealthConnection(token);

  const query = req.nextUrl.searchParams.get('query') ?? '';
  const url = new URL(`${BACKEND_URL}/api/food/search`);
  url.searchParams.set('query', query);

  const response = await fetch(url, {
    method: 'GET',
    headers: { cookie: `reciplease-session=${token}` },
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
}
