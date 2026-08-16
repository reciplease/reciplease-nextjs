/** @jest-environment node */
const mockGetToken = jest.fn();
jest.mock('next-auth/jwt', () => ({ getToken: (...args: unknown[]) => mockGetToken(...args) }));

import { NextRequest } from 'next/server';
import middleware, { config } from '@/proxy';

const ORIGINAL_ENV = process.env;

function fakeJwt(expiresInSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  mockGetToken.mockReset();
  global.fetch = jest.fn();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('middleware', () => {
  it('bypasses auth when NEXT_PUBLIC_AUTH_DISABLED is true', async () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('bypasses auth when NEXT_PUBLIC_FAKE_AUTH is true', async () => {
    process.env.NEXT_PUBLIC_FAKE_AUTH = 'true';
    const req = new NextRequest('http://localhost/inventory');

    await middleware(req);

    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('no session + public page: passes through, no redirect, no refresh attempt', async () => {
    mockGetToken.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/recipes');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('no session + gated page: redirects to /login', async () => {
    mockGetToken.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('location')).toContain('callbackUrl');
  });

  it('a token with an unrecoverable error redirects a gated page even though the outer cookie decoded fine', async () => {
    mockGetToken.mockResolvedValue({ sub: '123', error: 'SessionExpired' });
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.headers.get('location')).toContain('/login');
  });

  it('valid unexpired access token: passes through', async () => {
    mockGetToken.mockResolvedValue({ sub: '123', recipleaseToken: fakeJwt(3600) });
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('expired access token + successful silent refresh: passes through with the refreshed Set-Cookie headers copied on', async () => {
    mockGetToken.mockResolvedValue({ sub: '123', recipleaseToken: fakeJwt(-60) });
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'new-access-jwt' }), {
        status: 200,
        headers: { 'set-cookie': 'next-auth.session-token=rotated; Path=/; HttpOnly' },
      }),
    );
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('/api/auth/session') }),
      expect.anything(),
    );
    const setCookies =
      (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [
        response.headers.get('set-cookie') ?? '',
      ];
    expect(setCookies.some((c: string) => c.includes('next-auth.session-token=rotated'))).toBe(true);
  });

  it('expired access token + failed refresh + gated page: redirects', async () => {
    mockGetToken.mockResolvedValue({ sub: '123', recipleaseToken: fakeJwt(-60) });
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'SessionExpired' }), { status: 200 }),
    );
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.headers.get('location')).toContain('/login');
  });

  it('expired access token + failed refresh + public page: passes through, no redirect', async () => {
    mockGetToken.mockResolvedValue({ sub: '123', recipleaseToken: fakeJwt(-60) });
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'SessionExpired' }), { status: 200 }),
    );
    const req = new NextRequest('http://localhost/recipes/abc123');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('missing recipleaseToken entirely + failed refresh + public page: passes through', async () => {
    mockGetToken.mockResolvedValue({ sub: '123' });
    (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const req = new NextRequest('http://localhost/settings');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('treats /recipes/new as gated even though it shape-matches the public /recipes/[recipeId] pattern', async () => {
    mockGetToken.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/recipes/new');

    const response = await middleware(req);

    expect(response.headers.get('location')).toContain('/login');
  });

  it('treats a deeper recipes path (e.g. edit) as gated, not shape-matched as public', async () => {
    mockGetToken.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/recipes/abc123/edit');

    const response = await middleware(req);

    expect(response.headers.get('location')).toContain('/login');
  });

  it('treats /invite/[code] as public', async () => {
    mockGetToken.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/invite/abc123');

    const response = await middleware(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('silent-refresh network failures are treated as a failed refresh, not a crash', async () => {
    mockGetToken.mockResolvedValue({ sub: '123', recipleaseToken: fakeJwt(-60) });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    const req = new NextRequest('http://localhost/inventory');

    const response = await middleware(req);

    expect(response.headers.get('location')).toContain('/login');
  });
});

describe('config.matcher', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it('matches protected app pages and now also the public pages, unlike the old proxy.ts matcher', () => {
    expect(matcher.test('/inventory')).toBe(true);
    expect(matcher.test('/planner')).toBe(true);
    expect(matcher.test('/settings')).toBe(true);
    expect(matcher.test('/recipes')).toBe(true);
    expect(matcher.test('/recipes/abc123')).toBe(true);
    expect(matcher.test('/recipes/new')).toBe(true);
    expect(matcher.test('/invite/abc123')).toBe(true);
  });

  it('excludes the root, api routes, Next internals and static assets', () => {
    expect(matcher.test('/')).toBe(false);
    expect(matcher.test('/api/measures')).toBe(false);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/_next/image')).toBe(false);
    expect(matcher.test('/favicon.ico')).toBe(false);
    expect(matcher.test('/logo192.png')).toBe(false);
  });
});
