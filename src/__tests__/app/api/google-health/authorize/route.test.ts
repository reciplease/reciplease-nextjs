/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('@/lib/backend', () => ({
  BACKEND_URL: 'http://localhost:8080',
  accessToken: jest.fn(),
}));

import { GET } from '@/app/api/google-health/authorize/route';

const { accessToken } = require('@/lib/backend');

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, GOOGLE_CLIENT_ID: 'client-123', NEXTAUTH_URL: 'https://reciplease.org' };
  (accessToken as jest.Mock).mockReset();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/google-health/authorize', () => {
  it('redirects to /login when not signed in', async () => {
    (accessToken as jest.Mock).mockResolvedValue(undefined);

    const response = await GET(new NextRequest('https://reciplease.org/api/google-health/authorize'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://reciplease.org/login');
  });

  it('redirects to Google with the incremental-auth params', async () => {
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');

    const response = await GET(new NextRequest('https://reciplease.org/api/google-health/authorize'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('client_id')).toBe('client-123');
    expect(location.searchParams.get('redirect_uri')).toBe('https://reciplease.org/api/google-health/callback');
    expect(location.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/googlehealth.nutrition.readonly https://www.googleapis.com/auth/googlehealth.nutrition.writeonly',
    );
    expect(location.searchParams.get('access_type')).toBe('offline');
    expect(location.searchParams.get('prompt')).toBe('consent');
    expect(location.searchParams.get('include_granted_scopes')).toBe('true');

    const cookie = response.cookies.get('google_health_oauth');
    expect(cookie).toBeDefined();
    const stored = JSON.parse(cookie!.value);
    expect(stored.state).toBe(location.searchParams.get('state'));
    // No PKCE for this flow, unlike the old Fitbit one.
    expect(stored.codeVerifier).toBeUndefined();
    expect(location.searchParams.get('code_challenge')).toBeNull();
  });
});
