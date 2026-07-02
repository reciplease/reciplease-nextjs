/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('@/lib/backend', () => ({
  BACKEND_URL: 'http://localhost:8080',
  accessToken: jest.fn(),
}));

import { GET } from '@/app/api/fitbit/callback/route';

const { accessToken } = require('@/lib/backend');
const originalFetch = global.fetch;

function requestWithCookie(query: string, cookieValue?: string): NextRequest {
  const req = new NextRequest(`https://reciplease.org/api/fitbit/callback${query}`);
  if (cookieValue !== undefined) {
    req.cookies.set('fitbit_oauth', cookieValue);
  }
  return req;
}

beforeEach(() => {
  global.fetch = jest.fn();
  (accessToken as jest.Mock).mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('GET /api/fitbit/callback', () => {
  it('redirects with an error when the state cookie is missing', async () => {
    const response = await GET(requestWithCookie('?code=abc&state=xyz'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('fitbit')).toBe('error');
  });

  it('redirects with an error when state does not match the cookie', async () => {
    const cookie = JSON.stringify({ codeVerifier: 'verifier', state: 'expected-state' });
    const response = await GET(requestWithCookie('?code=abc&state=wrong-state', cookie));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('fitbit')).toBe('error');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redirects to /login when not signed in', async () => {
    const cookie = JSON.stringify({ codeVerifier: 'verifier', state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue(undefined);

    const response = await GET(requestWithCookie('?code=abc&state=state-1', cookie));

    expect(response.headers.get('location')).toBe('https://reciplease.org/login');
  });

  it('exchanges the code with the backend, forwarding the session cookie, and redirects with success', async () => {
    const cookie = JSON.stringify({ codeVerifier: 'verifier-1', state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');
    (fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 200 }));

    const response = await GET(requestWithCookie('?code=auth-code&state=state-1', cookie));

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/fitbit/callback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'auth-code', codeVerifier: 'verifier-1' }),
      }),
    );
    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(init.headers.cookie).toBe('reciplease-session=rcpls-jwt');

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('fitbit')).toBe('connected');
    expect(response.cookies.get('fitbit_oauth')?.value).toBe('');
  });

  it('redirects with an error when the backend rejects the exchange', async () => {
    const cookie = JSON.stringify({ codeVerifier: 'verifier-1', state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');
    (fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 400 }));

    const response = await GET(requestWithCookie('?code=auth-code&state=state-1', cookie));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('fitbit')).toBe('error');
  });

  it('redirects with an error when the backend call throws', async () => {
    const cookie = JSON.stringify({ codeVerifier: 'verifier-1', state: 'state-1' });
    (accessToken as jest.Mock).mockResolvedValue('rcpls-jwt');
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const response = await GET(requestWithCookie('?code=auth-code&state=state-1', cookie));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('fitbit')).toBe('error');
  });
});
