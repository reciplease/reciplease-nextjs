import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, idToken } from '@/lib/backend';

// Reverse-proxy for the backend's Swagger UI / OpenAPI docs, mounted under
// `/swagger`. The backend locks `/api/**` behind a Google id_token + allowlist
// (the `cloud` profile), so "Try it out" can't call it directly. By routing the
// whole thing through here we reuse Reciplease web's auth flow: the page is
// behind the NextAuth gate (forcing sign-in), and every proxied request gets
// the user's id_token attached as a bearer.
//
// We send `X-Forwarded-Prefix: /swagger` so SpringDoc serves its assets under
// this prefix. It cannot, however, fix the OpenAPI `servers` URL: Cloud Run
// overwrites `X-Forwarded-Host`, so SpringDoc emits an absolute URL on the
// *backend* host (app.reciplease.org). "Try it out" would then fire a
// cross-origin, token-less request straight at the backend and fail with a CORS
// error. So we rewrite the spec's `servers` to the relative `/swagger`, which
// Swagger UI resolves against the current origin — keeping calls same-origin and
// flowing back through this token-injecting proxy.

const PREFIX = '/swagger';

// SpringDoc's api-docs path (springdoc.api-docs.path=/openapi); reachable here as
// /swagger/openapi. This is the document whose `servers` we rewrite.
const OPENAPI_PATH = 'openapi';

// Hop-by-hop and encoding/length headers must not be copied verbatim: undici
// has already decoded the body by the time we re-emit it, so a stale
// `content-encoding` would make the browser try to decode plain bytes.
const STRIPPED_RESPONSE_HEADERS = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
];

// Swagger UI's static assets are immutable webjar content; cache them so reloads
// (and parallel asset fetches) don't each pay a double serverless round-trip.
const STATIC_ASSET = /\.(js|css|png|woff2?|ttf|ico|svg|map)$/i;

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await context.params;
  const search = request.nextUrl.search;
  const target = `${BACKEND_URL}/${path.join('/')}${search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('accept-encoding'); // let undici handle a plain body

  const token = await idToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('X-Forwarded-Prefix', PREFIX);
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

  // Rewrite the OpenAPI spec's servers to the relative prefix so "Try it out"
  // stays on this origin (see file header).
  if (path.join('/') === OPENAPI_PATH && upstream.ok) {
    const spec = await upstream.json();
    spec.servers = [{ url: PREFIX, description: 'Reciplease web (authenticated)' }];
    responseHeaders.set('content-type', 'application/json');
    responseHeaders.set('cache-control', 'no-store');
    return new NextResponse(JSON.stringify(spec), {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // Buffer the body: Netlify's function runtime streams these payloads slowly,
  // and they are small enough (<1MB) to send in one shot.
  const buffer = await upstream.arrayBuffer();
  if (STATIC_ASSET.test(path.join('/'))) {
    responseHeaders.set('cache-control', 'public, max-age=3600, immutable');
  }
  return new NextResponse(buffer, {
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
