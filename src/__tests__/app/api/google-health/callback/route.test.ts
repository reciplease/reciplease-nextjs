/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('@/lib/backend', () => ({
  BACKEND_URL: 'http://localhost:8080',
  accessToken: jest.fn(),
}));

jest.mock('@/lib/googleHealthTokens', () => ({
  exchangeGoogleHealthCode: jest.fn(),
  storeGoogleHealthTokens: jest.fn(),
}));

import { GET } from '@/app/api/google-health/callback/route';

const { accessToken } = require('@/lib/backend');
const { exchangeGoogleHealthCode, storeGoogleHealthTokens } = require('@/lib/googleHealthTokens');

function requestWithCookie(query: string, cookieValue?: string): NextRequest {
  const req = new NextRequest(`https://reciplease.org/api/google-health/callback${query}`);
  if (cookieValue !== undefined) {
    req.cookies.set('google_health_oauth', cookieValue);
  }
  return req;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, NEXTAUTH_URL: 'https://reciplease.org' };
  (accessToken as jest.Mock).mockReset();
  (exchangeGoogleHealthCode as jest.Mock).mockReset();
  (storeGoogleHealthTokens as jest.Mock).mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/google-health/callback', () => {
  it('redirects with an error when the state cookie is missing', async () => {
    const response = await GET(requestWithCookie('?code=abc&state=xyz'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('googleHealth')).toBe('error');
  });

  it('redirects with an error when state does not match the cookie', async () => {
    const cookie = JSON.stringify({ state: 'expected-state' });
    const response = await GET(requestWithCookie('?code=abc&state=wrong-state', cookie));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('googleHealth')).toBe('error');
    expect(exchangeGoogleHealthCode).not.toHaveBeenCalled();
  });

  it('redirects to /login when not signed in', async () => {
    const cookie = JSON.stringify({ state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue(undefined);

    const response = await GET(requestWithCookie('?code=abc&state=state-1', cookie));

    expect(response.headers.get('location')).toBe('https://reciplease.org/login');
  });

  it('exchanges the code for tokens and stores them, then redirects with success', async () => {
    const cookie = JSON.stringify({ state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');
    const tokens = {
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      scope: 'scope-1',
    };
    (exchangeGoogleHealthCode as jest.Mock).mockResolvedValue(tokens);
    (storeGoogleHealthTokens as jest.Mock).mockResolvedValue(undefined);

    const response = await GET(requestWithCookie('?code=auth-code&state=state-1', cookie));

    expect(exchangeGoogleHealthCode).toHaveBeenCalledWith(
      'auth-code',
      'https://reciplease.org/api/google-health/callback',
    );
    expect(storeGoogleHealthTokens).toHaveBeenCalledWith('rcpls-jwt', tokens);

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('googleHealth')).toBe('connected');
    expect(response.cookies.get('google_health_oauth')?.value).toBe('');
  });

  it('redirects with an error when the code exchange fails', async () => {
    const cookie = JSON.stringify({ state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');
    (exchangeGoogleHealthCode as jest.Mock).mockRejectedValue(new Error('exchange failed'));

    const response = await GET(requestWithCookie('?code=auth-code&state=state-1', cookie));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('googleHealth')).toBe('error');
    expect(storeGoogleHealthTokens).not.toHaveBeenCalled();
  });

  it('redirects with an error when storing tokens with the backend fails', async () => {
    const cookie = JSON.stringify({ state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');
    (exchangeGoogleHealthCode as jest.Mock).mockResolvedValue({
      access_token: 'access-1',
      expires_in: 3600,
    });
    (storeGoogleHealthTokens as jest.Mock).mockRejectedValue(new Error('backend rejected'));

    const response = await GET(requestWithCookie('?code=auth-code&state=state-1', cookie));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('googleHealth')).toBe('error');
  });
});
