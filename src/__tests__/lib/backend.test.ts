/** @jest-environment node */
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next-auth/jwt', () => ({ decode: jest.fn() }));

import { accessToken } from '@/lib/backend';

const { cookies } = require('next/headers');
const { decode } = require('next-auth/jwt');

function cookieStore(values: Record<string, string> = {}) {
  return {
    has: (name: string) => name in values,
    get: (name: string) => (name in values ? { value: values[name] } : undefined),
  };
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, NEXTAUTH_SECRET: 'secret' };
  (decode as jest.Mock).mockReset();
  (cookies as jest.Mock).mockReset();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('accessToken', () => {
  it('returns undefined when there is no session cookie', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore());

    expect(await accessToken()).toBeUndefined();
    expect(decode).not.toHaveBeenCalled();
  });

  it('returns undefined when NEXTAUTH_SECRET is not configured', async () => {
    delete process.env.NEXTAUTH_SECRET;
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));

    expect(await accessToken()).toBeUndefined();
    expect(decode).not.toHaveBeenCalled();
  });

  it('returns undefined when the session token cannot be decoded', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockRejectedValue(new Error('bad token'));

    expect(await accessToken()).toBeUndefined();
  });

  it('returns undefined when the decoded token has no recipleaseToken', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({});

    expect(await accessToken()).toBeUndefined();
  });

  it('returns the stored recipleaseToken', async () => {
    (cookies as jest.Mock).mockResolvedValue(cookieStore({ 'next-auth.session-token': 'abc' }));
    (decode as jest.Mock).mockResolvedValue({ recipleaseToken: 'rcpls-jwt' });

    expect(await accessToken()).toBe('rcpls-jwt');
  });

  it('joins chunked session cookies before decoding', async () => {
    (cookies as jest.Mock).mockResolvedValue(
      cookieStore({ 'next-auth.session-token.0': 'part1', 'next-auth.session-token.1': 'part2' }),
    );
    (decode as jest.Mock).mockResolvedValue({ recipleaseToken: 'rcpls-jwt' });

    expect(await accessToken()).toBe('rcpls-jwt');
    expect(decode).toHaveBeenCalledWith({ token: 'part1part2', secret: 'secret' });
  });

  it('prefers the secure session cookie name when present', async () => {
    (cookies as jest.Mock).mockResolvedValue(
      cookieStore({ '__Secure-next-auth.session-token': 'securetok' }),
    );
    (decode as jest.Mock).mockResolvedValue({ recipleaseToken: 'rcpls-jwt' });

    expect(await accessToken()).toBe('rcpls-jwt');
    expect(decode).toHaveBeenCalledWith({ token: 'securetok', secret: 'secret' });
  });
});
