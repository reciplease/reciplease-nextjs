/** @jest-environment node */
jest.mock('next-auth/middleware', () => ({ withAuth: jest.fn(() => jest.fn()) }));

import { NextRequest, NextResponse } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { withAuth } from 'next-auth/middleware';
import middleware, { config } from '@/proxy';

const mockAuthMiddleware = (withAuth as jest.Mock).mock.results[0].value as jest.Mock;

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  mockAuthMiddleware.mockReset();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('middleware', () => {
  it('configures withAuth with a custom sign-in page and requires a session token', () => {
    const options = (withAuth as jest.Mock).mock.calls[0][0];

    expect(options.pages).toEqual({ signIn: '/login' });
    expect(options.callbacks.authorized({ token: { sub: '123' } })).toBe(true);
    expect(options.callbacks.authorized({ token: null })).toBe(false);
  });

  it('bypasses auth when NEXT_PUBLIC_AUTH_DISABLED is true', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    const req = new NextRequest('http://localhost/recipes');

    const response = middleware(req, {} as Parameters<typeof middleware>[1]) as NextResponse;

    expect(response.status).toBe(200);
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it('bypasses auth when NEXT_PUBLIC_FAKE_AUTH is true', () => {
    process.env.NEXT_PUBLIC_FAKE_AUTH = 'true';
    const req = new NextRequest('http://localhost/recipes');

    middleware(req, {} as Parameters<typeof middleware>[1]);

    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it('delegates to the auth middleware otherwise', () => {
    const sentinel = NextResponse.next();
    mockAuthMiddleware.mockReturnValue(sentinel);
    const req = new NextRequest('http://localhost/inventory');
    const event = {} as Parameters<typeof middleware>[1];

    const result = middleware(req, event);

    expect(mockAuthMiddleware).toHaveBeenCalledWith(req as NextRequestWithAuth, event);
    expect(result).toBe(sentinel);
  });
});

describe('config.matcher', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it('matches protected app pages', () => {
    expect(matcher.test('/inventory')).toBe(true);
    expect(matcher.test('/planner')).toBe(true);
  });

  it('excludes the root, api routes, recipes, Next internals and static assets', () => {
    expect(matcher.test('/')).toBe(false);
    expect(matcher.test('/api/measures')).toBe(false);
    expect(matcher.test('/recipes')).toBe(false);
    expect(matcher.test('/recipes/abc123')).toBe(false);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/_next/image')).toBe(false);
    expect(matcher.test('/favicon.ico')).toBe(false);
    expect(matcher.test('/logo192.png')).toBe(false);
  });
});
