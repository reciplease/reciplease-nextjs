/** @jest-environment node */
import type { NextRequest } from 'next/server';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));

const mockHandler = jest.fn(async () => new Response('handled'));
jest.mock('next-auth', () => jest.fn(() => mockHandler));

const mockDecode = jest.fn();
jest.mock('next-auth/jwt', () => ({ decode: (...args: unknown[]) => mockDecode(...args) }));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockHandler.mockClear();
  mockDecode.mockReset();
  jest.resetModules();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/auth/[...nextauth]', () => {
  it('returns a fake session when fake auth is enabled and the path is /session', async () => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_FAKE_AUTH: 'true' };
    const { GET } = require('@/app/api/auth/[...nextauth]/route');

    const response = await GET(new Request('http://localhost') as unknown as NextRequest, {
      params: Promise.resolve({ nextauth: ['session'] }),
    });

    expect(await response.json()).toMatchObject({ user: { handle: 'local-dev-user' } });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('falls through to the real handler for other paths when fake auth is enabled', async () => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_FAKE_AUTH: 'true' };
    const { GET } = require('@/app/api/auth/[...nextauth]/route');

    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['signin'] }) };
    await GET(request, ctx);

    expect(mockHandler).toHaveBeenCalledWith(request, ctx);
  });

  it('falls through to the real handler when fake auth is disabled', async () => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_FAKE_AUTH: 'false' };
    const { GET } = require('@/app/api/auth/[...nextauth]/route');

    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['session'] }) };
    await GET(request, ctx);

    expect(mockHandler).toHaveBeenCalledWith(request, ctx);
  });

  it('passes through the handler response unchanged when there is no session cookie to mirror', async () => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_FAKE_AUTH: 'false', NEXTAUTH_SECRET: 'shh' };
    const { GET } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['csrf'] }) };

    const response = await GET(request, ctx);

    expect(await response.text()).toBe('handled');
    expect(mockDecode).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/[...nextauth]', () => {
  it('delegates to the NextAuth handler and returns its response when there is nothing to mirror', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'shh' };
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['callback', 'google'] }) };

    const response = await POST(request, ctx);

    expect(mockHandler).toHaveBeenCalledWith(request, ctx);
    expect(await response.text()).toBe('handled');
  });

  it('mirrors recipleaseRefreshToken from the outgoing session cookie onto a dedicated reciplease-refresh cookie', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'shh', NODE_ENV: 'production' };
    mockHandler.mockResolvedValueOnce(
      new Response('handled', {
        headers: { 'set-cookie': 'next-auth.session-token=abc.def.ghi; Path=/; HttpOnly' },
      }),
    );
    mockDecode.mockResolvedValueOnce({ recipleaseToken: 'access-jwt', recipleaseRefreshToken: 'refresh-jwt' });
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['session'] }) };

    const response = await POST(request, ctx);

    expect(mockDecode).toHaveBeenCalledWith(expect.objectContaining({ token: 'abc.def.ghi', secret: 'shh' }));
    const setCookies =
      (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [
        response.headers.get('set-cookie') ?? '',
      ];
    const mirrored = setCookies.find((c: string) => c.startsWith('reciplease-refresh='));
    expect(mirrored).toContain('reciplease-refresh=refresh-jwt');
    expect(mirrored).toContain('HttpOnly');
    expect(mirrored).toContain('Path=/api/auth');
    expect(mirrored).toContain('SameSite=Lax');
    expect(mirrored).toContain('Secure');
    expect(mirrored).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    // The original session cookie itself must still be present.
    expect(setCookies.some((c: string) => c.startsWith('next-auth.session-token='))).toBe(true);
  });

  it('omits Secure outside production', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'shh', NODE_ENV: 'development' };
    mockHandler.mockResolvedValueOnce(
      new Response('handled', {
        headers: { 'set-cookie': 'next-auth.session-token=abc.def.ghi; Path=/; HttpOnly' },
      }),
    );
    mockDecode.mockResolvedValueOnce({ recipleaseToken: 'access-jwt', recipleaseRefreshToken: 'refresh-jwt' });
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['session'] }) };

    const response = await POST(request, ctx);

    const setCookies =
      (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [
        response.headers.get('set-cookie') ?? '',
      ];
    const mirrored = setCookies.find((c: string) => c.startsWith('reciplease-refresh='));
    expect(mirrored).not.toContain('Secure');
  });

  it('emits a clearing cookie when the decoded session token has no recipleaseToken', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'shh' };
    mockHandler.mockResolvedValueOnce(
      new Response('handled', {
        headers: { 'set-cookie': 'next-auth.session-token=abc.def.ghi; Path=/; HttpOnly' },
      }),
    );
    mockDecode.mockResolvedValueOnce({});
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['signout'] }) };

    const response = await POST(request, ctx);

    const setCookies =
      (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [
        response.headers.get('set-cookie') ?? '',
      ];
    const mirrored = setCookies.find((c: string) => c.startsWith('reciplease-refresh='));
    expect(mirrored).toContain('Max-Age=0');
  });

  it('leaves the response untouched when signed in but there is no refresh token to mirror', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'shh' };
    mockHandler.mockResolvedValueOnce(
      new Response('handled', {
        headers: { 'set-cookie': 'next-auth.session-token=abc.def.ghi; Path=/; HttpOnly' },
      }),
    );
    mockDecode.mockResolvedValueOnce({ recipleaseToken: 'access-jwt' });
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['session'] }) };

    const response = await POST(request, ctx);

    const setCookies =
      (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [
        response.headers.get('set-cookie') ?? '',
      ];
    expect(setCookies.some((c: string) => c.startsWith('reciplease-refresh='))).toBe(false);
  });

  it('emits a clearing cookie on sign-out, where NextAuth writes an empty session cookie value without needing to decode anything', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'shh' };
    mockHandler.mockResolvedValueOnce(
      new Response('handled', {
        headers: { 'set-cookie': 'next-auth.session-token=; Max-Age=0; Path=/; HttpOnly' },
      }),
    );
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['signout'] }) };

    const response = await POST(request, ctx);

    expect(mockDecode).not.toHaveBeenCalled();
    const setCookies =
      (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [
        response.headers.get('set-cookie') ?? '',
      ];
    const mirrored = setCookies.find((c: string) => c.startsWith('reciplease-refresh='));
    expect(mirrored).toContain('Max-Age=0');
  });

  it('does not attempt to decode when NEXTAUTH_SECRET is unset', async () => {
    process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: undefined };
    mockHandler.mockResolvedValueOnce(
      new Response('handled', {
        headers: { 'set-cookie': 'next-auth.session-token=abc.def.ghi; Path=/; HttpOnly' },
      }),
    );
    const { POST } = require('@/app/api/auth/[...nextauth]/route');
    const request = new Request('http://localhost') as unknown as NextRequest;
    const ctx = { params: Promise.resolve({ nextauth: ['session'] }) };

    await POST(request, ctx);

    expect(mockDecode).not.toHaveBeenCalled();
  });
});
