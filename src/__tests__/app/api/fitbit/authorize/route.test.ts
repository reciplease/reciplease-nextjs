/** @jest-environment node */
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

jest.mock('@/lib/backend', () => ({
  BACKEND_URL: 'http://localhost:8080',
  accessToken: jest.fn(),
}));

import { GET } from '@/app/api/fitbit/authorize/route';

const { accessToken } = require('@/lib/backend');

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, FITBIT_CLIENT_ID: 'client-123', NEXTAUTH_URL: 'https://reciplease.org' };
  (accessToken as jest.Mock).mockReset();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/fitbit/authorize', () => {
  it('redirects to /login when not signed in', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);

    const response = await GET(new NextRequest('https://reciplease.org/api/fitbit/authorize'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://reciplease.org/login');
  });

  it('redirects to Fitbit with a PKCE challenge derived from the stored verifier', async () => {
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');

    const response = await GET(new NextRequest('https://reciplease.org/api/fitbit/authorize'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.origin + location.pathname).toBe('https://www.fitbit.com/oauth2/authorize');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('client_id')).toBe('client-123');
    expect(location.searchParams.get('redirect_uri')).toBe('https://reciplease.org/api/fitbit/callback');
    expect(location.searchParams.get('scope')).toBe('nutrition');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');

    const cookie = response.cookies.get('fitbit_oauth');
    expect(cookie).toBeDefined();
    const stored = JSON.parse(cookie!.value);
    expect(stored.state).toBe(location.searchParams.get('state'));

    const expectedChallenge = createHash('sha256').update(stored.codeVerifier).digest('base64url');
    expect(location.searchParams.get('code_challenge')).toBe(expectedChallenge);
  });

  it('honours an explicit FITBIT_REDIRECT_URI override', async () => {
    process.env.FITBIT_REDIRECT_URI = 'https://custom.example.com/callback';
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');

    const response = await GET(new NextRequest('https://reciplease.org/api/fitbit/authorize'));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('redirect_uri')).toBe('https://custom.example.com/callback');
  });
});
