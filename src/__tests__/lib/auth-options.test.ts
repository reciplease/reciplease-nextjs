/** @jest-environment node */
import { authOptions } from '@/lib/auth-options';
import type { Account, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

global.fetch = jest.fn();

const FRESH = Math.floor(Date.now() / 1000) + 3600;
const EXPIRED = Math.floor(Date.now() / 1000) - 100;

const { jwt, session } = authOptions.callbacks!;

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('authOptions config', () => {
  it('uses JWT sessions and a custom sign-in page', () => {
    expect(authOptions.session).toEqual({ strategy: 'jwt' });
    expect(authOptions.pages).toEqual({ signIn: '/login', error: '/login' });
  });
});

describe('jwt callback', () => {
  it('persists tokens from the account on initial sign-in', async () => {
    const token = {} as JWT;
    const account = {
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      expires_at: FRESH,
    } as unknown as Account;

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result).toMatchObject({
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresAt: FRESH,
    });
  });

  it('reuses the token while it is still fresh', async () => {
    const token = { idToken: 'tok123', expiresAt: FRESH } as unknown as JWT;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result).toBe(token);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes the token when expired', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    const token = { idToken: 'old-token', expiresAt: EXPIRED, refreshToken: 'refresh-token' } as unknown as JWT;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'new-token', expires_in: 3600 }),
    });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.idToken).toBe('new-token');
    expect(result.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('marks the token with a refresh error when the refresh response is not ok', async () => {
    const token = { idToken: 'old-token', expiresAt: EXPIRED, refreshToken: 'refresh-token' } as unknown as JWT;
    (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid_grant' }) });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.error).toBe('RefreshAccessTokenError');
  });

  it('falls back to defaults when client credentials, refresh token and refreshed fields are missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const token = { idToken: 'old-token', expiresAt: EXPIRED } as unknown as JWT;
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.idToken).toBe('old-token');
    expect(result.error).toBeUndefined();
    const body = (fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('client_id')).toBe('');
    expect(body.get('client_secret')).toBe('');
    expect(body.get('refresh_token')).toBe('');
  });

  it('marks the token with a refresh error when the refresh request throws', async () => {
    const token = { idToken: 'old-token', expiresAt: EXPIRED, refreshToken: 'refresh-token' } as unknown as JWT;
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.error).toBe('RefreshAccessTokenError');
  });
});

describe('session callback', () => {
  it('surfaces a refresh-error flag from the token onto the session', async () => {
    const token = { error: 'RefreshAccessTokenError' } as unknown as JWT;
    const sessionInput = { user: { name: 'Alice' }, expires: '2999-12-31T23:59:59.999Z' } as unknown as Parameters<
      NonNullable<typeof session>
    >[0]['session'];

    const result = await session!({ session: sessionInput, token, user: undefined as never, newSession: undefined, trigger: 'update' }) as Session;

    expect(result.error).toBe('RefreshAccessTokenError');
  });

  it('leaves error undefined when the token has none', async () => {
    const token = {} as JWT;
    const sessionInput = { user: { name: 'Alice' }, expires: '2999-12-31T23:59:59.999Z' } as unknown as Parameters<
      NonNullable<typeof session>
    >[0]['session'];

    const result = await session!({ session: sessionInput, token, user: undefined as never, newSession: undefined, trigger: 'update' }) as Session;

    expect(result.error).toBeUndefined();
  });
});
