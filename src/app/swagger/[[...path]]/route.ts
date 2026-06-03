import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, idToken } from '@/lib/backend';

// Reverse-proxy for the backend's Swagger UI / OpenAPI docs, mounted under
// `/swagger`. The backend locks `/api/**` behind a Google id_token + allowlist
// (the `cloud` profile), so "Try it out" can't call it directly. By routing the
// whole thing through here we reuse Reciplease web's auth flow: the page is
// behind the NextAuth middleware (forcing sign-in), and every proxied request
// gets the user's id_token attached as a bearer.
//
// We set `X-Forwarded-Prefix: /swagger` so SpringDoc emits all of its URLs
// (assets, the `/openapi` spec, and the OpenAPI server used by "Try it out")
// under this prefix, keeping them on the Next origin and thus flowing back
// through this token-injecting proxy. The backend must run with
// `server.forward-headers-strategy=framework` to honour that header.

const PREFIX = '/swagger';

// Hop-by-hop and encoding/length headers must not be copied verbatim: undici
// has already decoded the body by the time we re-stream it, so a stale
// `content-encoding` would make the browser try to decode plain bytes.
const STRIPPED_RESPONSE_HEADERS = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
];

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const search = request.nextUrl.search;
  const target = `${BACKEND_URL}/${(path ?? []).join('/')}${search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const token = await idToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Tell Spring it is reached via this prefix on the Next origin.
  headers.set('X-Forwarded-Prefix', PREFIX);
  headers.set('X-Forwarded-Host', request.nextUrl.host);
  headers.set('X-Forwarded-Proto', request.nextUrl.protocol.replace(':', ''));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(upstream.headers);
  STRIPPED_RESPONSE_HEADERS.forEach((h) => responseHeaders.delete(h));

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as HEAD,
  proxy as OPTIONS,
};
