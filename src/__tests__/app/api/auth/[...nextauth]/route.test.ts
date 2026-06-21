/** @jest-environment node */
import type { NextRequest } from 'next/server';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));

const mockHandler = jest.fn(async () => new Response('handled'));
jest.mock('next-auth', () => jest.fn(() => mockHandler));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockHandler.mockClear();
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

    expect(await response.json()).toMatchObject({ user: { email: 'user@reciplease.org' } });
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
});

describe('POST /api/auth/[...nextauth]', () => {
  it('is the NextAuth handler', () => {
    const { POST } = require('@/app/api/auth/[...nextauth]/route');

    expect(POST).toBe(mockHandler);
  });
});
