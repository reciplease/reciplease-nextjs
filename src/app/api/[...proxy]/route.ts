import { type NextRequest } from 'next/server';
import { BACKEND_URL, accessToken } from '@/lib/backend';

// Generic passthrough to the Java backend: every /api/* call that isn't one of the
// handful of dedicated routes (auth, manifest — see src/app/swagger for the
// swagger proxy, which lives outside /api) ends up here. No business logic, no
// per-resource shaping — the backend owns all of that now.
//
// Authentication happens here, server-side: we decode the NextAuth session
// cookie and forward the Reciplease JWT as the `reciplease-session` cookie the
// backend's resolver reads. Doing it in the proxy (rather than a separate
// /api/session-cookie round-trip the client had to make before every page's
// first data fetch) keeps each navigation to a single backend round-trip.
async function handleRequest(req: NextRequest, segments: string[]): Promise<Response> {
  const { searchParams } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.delete('host');

  const token = await accessToken();
  if (token) {
    // Replace the browser's cookies (NextAuth's, irrelevant to the backend) with
    // just the session token the backend authenticates against.
    headers.set('cookie', `reciplease-session=${token}`);
  } else {
    // Not signed in — don't forward browser cookies; let public endpoints serve
    // the anonymous response.
    headers.delete('cookie');
  }

  const qs = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const url = `${BACKEND_URL}/api/${segments.join('/')}${qs}`;

  const response = await fetch(url, {
    method: req.method,
    headers,
    ...(req.method !== 'GET' && req.method !== 'DELETE' ? { body: await req.text() } : {}),
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
}

type RouteParams = { params: Promise<{ proxy: string[] }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).proxy);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).proxy);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).proxy);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).proxy);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).proxy);
}
