import { type NextRequest } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

// Generic passthrough to the Java backend: every /api/* call that isn't one of the
// handful of dedicated routes (auth, manifest — see src/app/swagger for the
// swagger proxy, which lives outside /api) ends up here. No business logic, no
// per-resource shaping — the backend owns all of that now. The browser's
// `reciplease-session` cookie rides along in the forwarded `Cookie` header; Spring
// Security reads it directly (see CookieBearerTokenResolver on the backend), so
// there's no cookie-decoding or bearer-header translation needed on this side.
async function handleRequest(req: NextRequest, segments: string[]): Promise<Response> {
  const { searchParams } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.delete('host');

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
