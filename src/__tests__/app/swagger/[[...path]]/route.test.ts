/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } from '@/app/swagger/[[...path]]/route';

jest.mock('@/lib/backend', () => ({ BACKEND_URL: 'https://backend.example', accessToken: jest.fn() }));

const { accessToken } = require('@/lib/backend');

global.fetch = jest.fn();

function mockUpstream(overrides: Record<string, unknown> = {}) {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'text/html', 'content-encoding': 'gzip' }),
    json: async () => ({}),
    arrayBuffer: async () => new TextEncoder().encode('hello').buffer,
    ...overrides,
  });
}

describe('swagger proxy', () => {
  afterEach(() => {
    (fetch as jest.Mock).mockReset();
    (accessToken as jest.Mock).mockReset();
  });

  it('exposes the same proxy handler for every HTTP method', () => {
    expect(PUT).toBe(GET);
    expect(PATCH).toBe(GET);
    expect(DELETE).toBe(GET);
    expect(HEAD).toBe(GET);
    expect(OPTIONS).toBe(GET);
    expect(POST).toBe(GET);
  });

  it('proxies a GET request, stripping hop-by-hop headers and forwarding the response body', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);
    mockUpstream();

    const request = new NextRequest('http://localhost/swagger/index.html', {
      headers: { host: 'localhost', connection: 'keep-alive', 'accept-encoding': 'gzip', 'x-custom': 'value' },
    });
    const response = await GET(request, { params: Promise.resolve({ path: ['index.html'] }) });

    const [target, init] = (fetch as jest.Mock).mock.calls[0];
    expect(target).toBe('https://backend.example/index.html');
    expect(init.method).toBe('GET');
    expect((init.headers as Headers).has('host')).toBe(false);
    expect((init.headers as Headers).has('connection')).toBe(false);
    expect((init.headers as Headers).has('accept-encoding')).toBe(false);
    expect((init.headers as Headers).has('Authorization')).toBe(false);
    expect((init.headers as Headers).get('x-custom')).toBe('value');
    expect((init.headers as Headers).get('X-Forwarded-Prefix')).toBe('/swagger');
    expect((init.headers as Headers).get('X-Forwarded-Proto')).toBe('http');

    expect(response.status).toBe(200);
    expect(response.headers.has('content-encoding')).toBe(false);
    expect(await response.text()).toBe('hello');
  });

  it('adds an Authorization header when signed in', async () => {
    (accessToken as jest.Mock).mockResolvedValue('tok123');
    mockUpstream();

    const request = new NextRequest('http://localhost/swagger/index.html');
    await GET(request, { params: Promise.resolve({ path: ['index.html'] }) });

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok123');
  });

  it('defaults to the backend root when no path segments are provided', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);
    mockUpstream();

    const request = new NextRequest('http://localhost/swagger');
    await GET(request, { params: Promise.resolve({}) });

    const [target] = (fetch as jest.Mock).mock.calls[0];
    expect(target).toBe('https://backend.example/');
  });

  it('forwards the request body for non-GET/HEAD requests', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);
    mockUpstream();

    const request = new NextRequest('http://localhost/swagger/api/inventory', {
      method: 'POST',
      body: 'payload',
    });
    await POST(request, { params: Promise.resolve({ path: ['api', 'inventory'] }) });

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(Buffer.from(init.body as ArrayBuffer).toString()).toBe('payload');
  });

  it("rewrites the OpenAPI spec's servers to the relative prefix", async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);
    mockUpstream({
      json: async () => ({ openapi: '3.0.1', servers: [{ url: 'https://app.reciplease.org' }] }),
    });

    const request = new NextRequest('http://localhost/swagger/openapi');
    const response = await GET(request, { params: Promise.resolve({ path: ['openapi'] }) });

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      openapi: '3.0.1',
      servers: [{ url: '/swagger', description: 'Reciplease web (authenticated)' }],
    });
  });

  it('does not rewrite the OpenAPI spec when the upstream request fails', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);
    mockUpstream({ ok: false, status: 502, statusText: 'Bad Gateway' });

    const request = new NextRequest('http://localhost/swagger/openapi');
    const response = await GET(request, { params: Promise.resolve({ path: ['openapi'] }) });

    expect(response.status).toBe(502);
    expect(await response.text()).toBe('hello');
  });

  it('sets a long cache-control header for static assets', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);
    mockUpstream();

    const request = new NextRequest('http://localhost/swagger/webjars/swagger-ui/swagger-ui.css');
    const response = await GET(request, { params: Promise.resolve({ path: ['webjars', 'swagger-ui', 'swagger-ui.css'] }) });

    expect(response.headers.get('cache-control')).toBe('public, max-age=3600, immutable');
  });
});
