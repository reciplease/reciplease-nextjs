/** @jest-environment node */
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next-auth/jwt', () => ({ decode: jest.fn() }));

import { backendFetch, idToken, BACKEND_URL } from '@/lib/backend';

const { cookies } = require('next/headers');
const { decode } = require('next-auth/jwt');

global.fetch = jest.fn();

function cookieStore(values: Record<string, string> = {}) {
  return {
    has: (name: string) => name in values,
    get: (name: string) => (name in values ? { value: values[name] } : undefined),
  };
}

const ORIGINAL_ENV = process.env;
const FRESH = Math.floor(Date.now() / 1000) + 3600;
const EXPIRED = Math.floor(Date.now() / 1000) - 100;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'secret' };
  (fetch as jest.Mock).mockReset();
  (decode as jest.Mock).mockReset();
  (cookies as jest.Mock).mockReset();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('idToken', () => {
  it('returns undefined when there is no session cookie', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore());

    expect(await idToken()).toBeUndefined();
    expect(decode).not.toHaveBeenCalled();
  });

  it('returns undefined when NEXTAUTH_SECRET is not configured', async () => {
    delete process.env.NEXTAUTH_SECRET;
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));

    expect(await idToken()).toBeUndefined();
    expect(decode).not.toHaveBeenCalled();
  });

  it('returns undefined when the session token cannot be decoded', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockRejectedValue(new Error('bad token'));

    expect(await idToken()).toBeUndefined();
  });

  it('returns undefined when the decoded token has no idToken', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({});

    expect(await idToken()).toBeUndefined();
  });

  it('returns the stored idToken while it is still fresh', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({ idToken: 'tok123', expiresAt: FRESH });

    expect(await idToken()).toBe('tok123');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('joins chunked session cookies before decoding', async () => {
    (cookies as jest.Mock).mockResolvedValue(
      cookieStore({ 'next-auth.session-token.0': 'part1', 'next-auth.session-token.1': 'part2' }),
    );
    (decode as jest.Mock).mockResolvedValue({ idToken: 'tok123', expiresAt: FRESH });

    expect(await idToken()).toBe('tok123');
    expect(decode).toHaveBeenCalledWith({ token: 'part1part2', secret: 'secret' });
  });

  it('prefers the secure session cookie name when present', async () => {
    (cookies as jest.Mock).mockResolvedValue(
      cookieStore({ '__Secure-next-auth.session-token': 'securetok' }),
    );
    (decode as jest.Mock).mockResolvedValue({ idToken: 'tok123', expiresAt: FRESH });

    expect(await idToken()).toBe('tok123');
    expect(decode).toHaveBeenCalledWith({ token: 'securetok', secret: 'secret' });
  });

  it('refreshes an expired idToken using the stored refresh token', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({
      idToken: 'old-token',
      expiresAt: EXPIRED,
      refreshToken: 'refresh-token',
    });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id_token: 'new-token' }) });

    expect(await idToken()).toBe('new-token');
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = (fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('refresh_token')).toBe('refresh-token');
    expect(body.get('client_id')).toBe('client-id');
  });

  it('falls back to the stored idToken when the refresh response is not ok', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({
      idToken: 'old-token',
      expiresAt: EXPIRED,
      refreshToken: 'refresh-token',
    });
    (fetch as jest.Mock).mockResolvedValue({ ok: false });

    expect(await idToken()).toBe('old-token');
  });

  it('falls back to the stored idToken when the refresh request throws', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({
      idToken: 'old-token',
      expiresAt: EXPIRED,
      refreshToken: 'refresh-token',
    });
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    expect(await idToken()).toBe('old-token');
  });

  it('falls back to the stored idToken when the refresh request throws a non-Error value', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({
      idToken: 'old-token',
      expiresAt: EXPIRED,
      refreshToken: 'refresh-token',
    });
    (fetch as jest.Mock).mockRejectedValue('boom');

    expect(await idToken()).toBe('old-token');
  });

  it('falls back to the stored idToken when Google client credentials are not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({
      idToken: 'old-token',
      expiresAt: EXPIRED,
      refreshToken: 'refresh-token',
    });

    expect(await idToken()).toBe('old-token');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the stored idToken best-effort when expired with no refresh token', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({ idToken: 'old-token', expiresAt: EXPIRED });

    expect(await idToken()).toBe('old-token');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('backendFetch', () => {
  it('adds an Authorization header when signed in', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({ idToken: 'tok123', expiresAt: FRESH });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await backendFetch('/api/measures');

    const [url, init] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/api/measures`);
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok123');
  });

  it('omits the Authorization header when not signed in', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore());
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await backendFetch('/api/measures');

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).has('Authorization')).toBe(false);
  });

  it('preserves the method, body and other headers from init', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({ idToken: 'tok123', expiresAt: FRESH });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await backendFetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Milk' }),
    });

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Milk' }));
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok123');
  });
});
