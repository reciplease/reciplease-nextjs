/** @jest-environment node */
jest.mock('@/lib/backend', () => ({ accessToken: jest.fn(), BACKEND_URL: 'http://backend.test' }));
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: jest.fn() })),
}));
import { authOptions, exchangeIdentity } from '@/lib/auth-options';
import { accessToken } from '@/lib/backend';
import { OAuth2Client } from 'google-auth-library';
import type { Account, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

global.fetch = jest.fn();
const accessTokenMock = accessToken as jest.Mock;
// auth-options.ts constructs a single `new OAuth2Client(...)` at module load, so
// there's exactly one mocked instance to pull verifyIdToken off of.
const mockVerifyIdToken = (OAuth2Client as unknown as jest.Mock).mock.results[0].value.verifyIdToken as jest.Mock;

const { jwt, session } = authOptions.callbacks!;

const ORIGINAL_ENV = process.env;

/** A structurally-valid (unsigned) JWT with only an `exp` claim — enough for jwtExpiryMillis. */
function fakeJwt(expiresInSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  accessTokenMock.mockReset();
  accessTokenMock.mockResolvedValue(undefined);
  mockVerifyIdToken.mockReset();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('authOptions config', () => {
  it('uses JWT sessions and a custom sign-in page', () => {
    expect(authOptions.session).toEqual({ strategy: 'jwt', maxAge: 24 * 60 * 60 });
    expect(authOptions.pages).toEqual({ signIn: '/login', error: '/login' });
  });
});

describe('exchangeIdentity', () => {
  it('sends provider, providerId, and linkToken to the backend and returns the token/refreshToken/userId/handle on success', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', refreshToken: 'rcpls-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await exchangeIdentity(
      { provider: 'github', providerAccountId: '12345' },
      'old-rcpls-jwt',
      'me@github.com',
    );

    expect(result).toEqual({
      ok: true,
      token: 'rcpls-jwt',
      refreshToken: 'rcpls-refresh',
      userId: 'user-1',
      handle: 'chef',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/exchange'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Secret': expect.any(String) }),
        body: JSON.stringify({
          provider: 'github',
          providerId: '12345',
          linkToken: 'old-rcpls-jwt',
          email: 'me@github.com',
        }),
      }),
    );
  });

  it('normalises a null handle to null', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', userId: 'user-1', handle: null }),
    });

    const result = await exchangeIdentity(
      { provider: 'google', providerAccountId: 'sub-1' },
      undefined,
      'me@gmail.com',
    );

    expect(result).toEqual({ ok: true, token: 'rcpls-jwt', refreshToken: null, userId: 'user-1', handle: null });
  });

  it('reports a null refreshToken when the backend returns none (a provider-linking exchange)', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', refreshToken: null, userId: 'user-1', handle: 'chef' }),
    });

    const result = await exchangeIdentity(
      { provider: 'github', providerAccountId: '12345' },
      'old-rcpls-jwt',
      'me@github.com',
    );

    expect(result).toEqual({ ok: true, token: 'rcpls-jwt', refreshToken: null, userId: 'user-1', handle: 'chef' });
  });

  it('reports an IdentityConflict on a 409 (linking an identity already claimed)', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 409 });

    const result = await exchangeIdentity(
      { provider: 'github', providerAccountId: '12345' },
      'old-rcpls-jwt',
      'me@github.com',
    );

    expect(result).toEqual({ ok: false, error: 'IdentityConflict' });
  });

  it('reports a generic ExchangeError on other non-2xx responses', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await exchangeIdentity(
      { provider: 'google', providerAccountId: 'sub-1' },
      undefined,
      'me@gmail.com',
    );

    expect(result).toEqual({ ok: false, error: 'ExchangeError' });
  });

  it('reports an ExchangeError when the request throws', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const result = await exchangeIdentity(
      { provider: 'google', providerAccountId: 'sub-1' },
      undefined,
      'me@gmail.com',
    );

    expect(result).toEqual({ ok: false, error: 'ExchangeError' });
  });
});

describe('jwt callback', () => {
  it('exchanges the provider identity and stores the Reciplease JWT/userId/handle on fresh sign-in', async () => {
    const token = {} as JWT;
    const account = { provider: 'google', providerAccountId: 'sub-1' } as unknown as Account;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', refreshToken: 'rcpls-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account, user: { email: 'me@gmail.com' } as never });

    expect(result).toMatchObject({
      recipleaseToken: 'rcpls-jwt',
      recipleaseRefreshToken: 'rcpls-refresh',
      userId: 'user-1',
      handle: 'chef',
      error: undefined,
    });
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.email).toBe('me@gmail.com');
  });

  it('does not stomp an existing refresh token when the exchange is a provider-linking call (refreshToken: null)', async () => {
    const token = { recipleaseToken: 'existing-jwt', recipleaseRefreshToken: 'existing-refresh' } as JWT;
    const account = { provider: 'github', providerAccountId: '999' } as unknown as Account;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'linked-jwt', refreshToken: null, userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result.recipleaseToken).toBe('linked-jwt');
    expect(result.recipleaseRefreshToken).toBe('existing-refresh');
  });

  it('passes the existing recipleaseToken on the token as linkToken (linking a 2nd provider)', async () => {
    const token = { recipleaseToken: 'existing-jwt', userId: 'user-1', handle: 'chef' } as JWT;
    const account = { provider: 'github', providerAccountId: '999' } as unknown as Account;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'existing-jwt', userId: 'user-1', handle: 'chef' }),
    });

    await jwt!({ token, account, user: undefined as never });

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.linkToken).toBe('existing-jwt');
  });

  it('recovers the linkToken from the session cookie when NextAuth drops it from the token', async () => {
    // The real link case: an already-signed-in user links a 2nd provider, but
    // NextAuth gives a fresh token with no recipleaseToken — it must come from
    // the existing session cookie (accessToken()), or linking creates a new user.
    const token = {} as JWT;
    const account = { provider: 'github', providerAccountId: '999' } as unknown as Account;
    accessTokenMock.mockResolvedValue('cookie-recovered-jwt');
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rotated-jwt', userId: 'user-1', handle: 'chef' }),
    });

    await jwt!({ token, account, user: undefined as never });

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.linkToken).toBe('cookie-recovered-jwt');
  });

  it('treats it as a fresh login (no linkToken) when there is no session cookie', async () => {
    const token = {} as JWT;
    const account = { provider: 'google', providerAccountId: 'sub-1' } as unknown as Account;
    accessTokenMock.mockResolvedValue(undefined);
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', userId: 'user-1', handle: null }),
    });

    await jwt!({ token, account, user: undefined as never });

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.linkToken).toBeUndefined();
  });

  it('falls back to a fresh login if recovering the cookie token throws', async () => {
    const token = {} as JWT;
    const account = { provider: 'google', providerAccountId: 'sub-1' } as unknown as Account;
    accessTokenMock.mockRejectedValue(new Error('cookies() outside request scope'));
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', userId: 'user-1', handle: null }),
    });

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result).toMatchObject({ recipleaseToken: 'rcpls-jwt' });
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.linkToken).toBeUndefined();
  });

  it('sets an error on the token when the exchange fails, without crashing', async () => {
    const token = { recipleaseToken: 'existing-jwt' } as JWT;
    const account = { provider: 'github', providerAccountId: '999' } as unknown as Account;
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 409 });

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result.error).toBe('IdentityConflict');
  });

  it('leaves a token that is not close to expiring and already has a refresh token untouched (subsequent requests)', async () => {
    const token = { recipleaseToken: fakeJwt(12 * 60 * 60), recipleaseRefreshToken: 'existing-refresh', handle: 'chef' } as JWT;
    const originalRecipleaseToken = token.recipleaseToken;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result).toBe(token);
    expect(result.recipleaseToken).toBe(originalRecipleaseToken);
    expect(result.error).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears the token and sets SessionExpired once the embedded JWT has actually expired', async () => {
    const token = { recipleaseToken: fakeJwt(-60), handle: 'chef' } as JWT;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBeUndefined();
    expect(result.error).toBe('SessionExpired');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats an unparseable recipleaseToken as expired', async () => {
    const token = { recipleaseToken: 'not-a-real-jwt', handle: 'chef' } as JWT;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBeUndefined();
    expect(result.error).toBe('SessionExpired');
  });

  it('silently redeems a refresh token via POST /api/auth/refresh, with the refresh token as a cookie header, when the access token is nearing expiry', async () => {
    const token = {
      recipleaseToken: fakeJwt(5 * 60),
      recipleaseRefreshToken: 'old-refresh',
      userId: 'user-1',
      handle: 'chef',
    } as JWT;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'refreshed-jwt', refreshToken: 'rotated-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBe('refreshed-jwt');
    expect(result.recipleaseRefreshToken).toBe('rotated-refresh');
    expect(result.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ cookie: 'reciplease-refresh=old-refresh' }),
      }),
    );
  });

  it('keeps the still-valid access token in place when a near-expiry redemption attempt fails but the access token has not fully expired yet', async () => {
    const originalRecipleaseToken = fakeJwt(5 * 60);
    const token = {
      recipleaseToken: originalRecipleaseToken,
      recipleaseRefreshToken: 'old-refresh',
      userId: 'user-1',
      handle: 'chef',
    } as JWT;
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBe(originalRecipleaseToken);
    expect(result.recipleaseRefreshToken).toBe('old-refresh');
    expect(result.error).toBeUndefined();
  });

  it('clears the session and sets SessionExpired when redemption fails and the access token has already fully expired', async () => {
    const token = {
      recipleaseToken: fakeJwt(-60),
      recipleaseRefreshToken: 'old-refresh',
      userId: 'user-1',
      handle: 'chef',
    } as JWT;
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBeUndefined();
    expect(result.recipleaseRefreshToken).toBeUndefined();
    expect(result.error).toBe('SessionExpired');
  });

  it('redeems a dead refresh token successfully even after the access token has fully expired (no bearer auth needed)', async () => {
    const token = {
      recipleaseToken: fakeJwt(-60),
      recipleaseRefreshToken: 'old-refresh',
      userId: 'user-1',
      handle: 'chef',
    } as JWT;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'refreshed-jwt', refreshToken: 'rotated-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBe('refreshed-jwt');
    expect(result.error).toBeUndefined();
  });

  it('falls back to the pre-migration behaviour (clear once expired) when there is no refresh token at all', async () => {
    const token = { recipleaseToken: fakeJwt(-60), handle: 'chef' } as JWT;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBeUndefined();
    expect(result.error).toBe('SessionExpired');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('backfills a refresh token instead of just waiting, when near expiry but not yet expired and there is no refresh token', async () => {
    const token = { recipleaseToken: fakeJwt(5 * 60), handle: 'chef' } as JWT;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'reminted-jwt', refreshToken: 'backfilled-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseRefreshToken).toBe('backfilled-refresh');
    expect(result.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh-token'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: `Bearer ${token.recipleaseToken}` }),
      }),
    );
  });

  it('backfills a refresh token via bearer-authenticated POST /api/auth/refresh-token when the access token is valid but there is no refresh token yet', async () => {
    const token = { recipleaseToken: fakeJwt(12 * 60 * 60), handle: 'chef' } as JWT;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'reminted-jwt', refreshToken: 'backfilled-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseRefreshToken).toBe('backfilled-refresh');
    expect(result.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh-token'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: `Bearer ${token.recipleaseToken}` }),
      }),
    );
  });

  it('leaves the session intact (no error) when the refresh-token backfill call fails, so it can be retried next poll', async () => {
    const originalRecipleaseToken = fakeJwt(12 * 60 * 60);
    const token = { recipleaseToken: originalRecipleaseToken, handle: 'chef' } as JWT;
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseToken).toBe(originalRecipleaseToken);
    expect(result.recipleaseRefreshToken).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('does not attempt a backfill once a refresh token is already present', async () => {
    const token = { recipleaseToken: fakeJwt(12 * 60 * 60), recipleaseRefreshToken: 'already-have-one', handle: 'chef' } as JWT;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result.recipleaseRefreshToken).toBe('already-have-one');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('adopts the token/userId/handle authorize() already produced for the passkey provider, without calling /api/auth/exchange', async () => {
    const token = {} as JWT;
    const account = { provider: 'passkey' } as unknown as Account;
    const user = {
      id: 'user-1',
      recipleaseToken: 'passkey-jwt',
      recipleaseRefreshToken: 'passkey-refresh',
      handle: 'chef',
    } as never;

    const result = await jwt!({ token, account, user });

    expect(result).toMatchObject({
      recipleaseToken: 'passkey-jwt',
      recipleaseRefreshToken: 'passkey-refresh',
      userId: 'user-1',
      handle: 'chef',
      error: undefined,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sets an error for the passkey provider when authorize() produced no user', async () => {
    const token = {} as JWT;
    const account = { provider: 'passkey' } as unknown as Account;

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result.error).toBe('ExchangeError');
  });

  it('adopts the token/userId/handle authorize() already produced for the google-onetap provider, without calling /api/auth/exchange', async () => {
    const token = {} as JWT;
    const account = { provider: 'google-onetap' } as unknown as Account;
    const user = {
      id: 'user-1',
      recipleaseToken: 'gsi-jwt',
      recipleaseRefreshToken: 'gsi-refresh',
      handle: 'chef',
    } as never;

    const result = await jwt!({ token, account, user });

    expect(result).toMatchObject({
      recipleaseToken: 'gsi-jwt',
      recipleaseRefreshToken: 'gsi-refresh',
      userId: 'user-1',
      handle: 'chef',
      error: undefined,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sets an error for the google-onetap provider when authorize() produced no user', async () => {
    const token = {} as JWT;
    const account = { provider: 'google-onetap' } as unknown as Account;

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result.error).toBe('ExchangeError');
  });
});

describe('passkey CredentialsProvider', () => {
  // CredentialsProvider() always sets provider.id to the literal "credentials"; the id/authorize
  // we configured live under provider.options instead. There are now two CredentialsProviders
  // (this one and google-onetap), so match on the configured id, not just type.
  const passkeyProvider = (authOptions.providers.find(
    (p) => p.type === 'credentials' && (p as unknown as { options: { id: string } }).options.id === 'passkey',
  ) as unknown as {
    options: { authorize: (credentials: Record<string, string> | undefined) => Promise<unknown> };
  }).options;

  it('calls login/finish for mode=login and returns a user with the minted token and refresh token', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', refreshToken: 'rcpls-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await passkeyProvider.authorize({ mode: 'login', challenge: 'chal-1', credential: '{"id":"cred-1"}' });

    expect(result).toEqual({
      id: 'user-1',
      recipleaseToken: 'rcpls-jwt',
      recipleaseRefreshToken: 'rcpls-refresh',
      handle: 'chef',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/passkey/login/finish'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ challenge: 'chal-1', credential: { id: 'cred-1' } }),
      }),
    );
  });

  it('calls signup/finish for mode=signup', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', userId: 'new-user', handle: null }),
    });

    const result = await passkeyProvider.authorize({ mode: 'signup', challenge: 'chal-2', credential: '{"id":"cred-2"}' });

    expect(result).toEqual({ id: 'new-user', recipleaseToken: 'rcpls-jwt', handle: null });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/passkey/signup/finish'), expect.anything());
  });

  it('returns null when the backend rejects the ceremony', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });

    const result = await passkeyProvider.authorize({ mode: 'login', challenge: 'chal-1', credential: '{}' });

    expect(result).toBeNull();
  });

  it('returns null when required fields are missing', async () => {
    expect(await passkeyProvider.authorize({ mode: 'login', challenge: 'chal-1', credential: '' })).toBeNull();
    expect(await passkeyProvider.authorize(undefined)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null for an unrecognised mode', async () => {
    const result = await passkeyProvider.authorize({ mode: 'reset', challenge: 'chal-1', credential: '{}' });

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('google-onetap CredentialsProvider', () => {
  const googleOneTapProvider = (authOptions.providers.find(
    (p) => p.type === 'credentials' && (p as unknown as { options: { id: string } }).options.id === 'google-onetap',
  ) as unknown as {
    options: { authorize: (credentials: Record<string, string> | undefined) => Promise<unknown> };
  }).options;

  it('verifies the ID token, exchanges the identity for provider "google", and returns a user with the minted token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-1', email: 'me@gmail.com' }),
    });
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', refreshToken: 'rcpls-refresh', userId: 'user-1', handle: 'chef' }),
    });

    const result = await googleOneTapProvider.authorize({ credential: 'id-token-1' });

    expect(result).toEqual({
      id: 'user-1',
      recipleaseToken: 'rcpls-jwt',
      recipleaseRefreshToken: 'rcpls-refresh',
      handle: 'chef',
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith(expect.objectContaining({ idToken: 'id-token-1' }));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/exchange'),
      expect.objectContaining({
        body: JSON.stringify({ provider: 'google', providerId: 'google-sub-1', linkToken: undefined, email: 'me@gmail.com' }),
      }),
    );
  });

  it('returns null when the token has no sub claim', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'me@gmail.com' }) });

    const result = await googleOneTapProvider.authorize({ credential: 'id-token-1' });

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null when verification throws (invalid/expired token)', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad token'));

    const result = await googleOneTapProvider.authorize({ credential: 'garbage' });

    expect(result).toBeNull();
  });

  it('returns null when the backend exchange fails', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-1', email: 'me@gmail.com' }) });
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await googleOneTapProvider.authorize({ credential: 'id-token-1' });

    expect(result).toBeNull();
  });

  it('returns null when no credential is provided', async () => {
    const result = await googleOneTapProvider.authorize(undefined);

    expect(result).toBeNull();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});

describe('session callback', () => {
  it('exposes the Reciplease JWT as accessToken and the handle on session.user', async () => {
    const token = { recipleaseToken: 'rcpls-jwt', handle: 'chef' } as unknown as JWT;
    const sessionInput = { user: { name: 'Alice' }, expires: '2999-12-31T23:59:59.999Z' } as unknown as Parameters<
      NonNullable<typeof session>
    >[0]['session'];

    const result = (await session!({
      session: sessionInput,
      token,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    })) as Session;

    expect(result.accessToken).toBe('rcpls-jwt');
    expect(result.user?.handle).toBe('chef');
    expect(result.error).toBeUndefined();
  });

  it('surfaces an error flag from the token onto the session', async () => {
    const token = { error: 'IdentityConflict' } as unknown as JWT;
    const sessionInput = { user: { name: 'Alice' }, expires: '2999-12-31T23:59:59.999Z' } as unknown as Parameters<
      NonNullable<typeof session>
    >[0]['session'];

    const result = (await session!({
      session: sessionInput,
      token,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    })) as Session;

    expect(result.error).toBe('IdentityConflict');
  });

  it('defaults handle to null when the token has none', async () => {
    const token = { recipleaseToken: 'rcpls-jwt' } as unknown as JWT;
    const sessionInput = { user: { name: 'Alice' }, expires: '2999-12-31T23:59:59.999Z' } as unknown as Parameters<
      NonNullable<typeof session>
    >[0]['session'];

    const result = (await session!({
      session: sessionInput,
      token,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    })) as Session;

    expect(result.user?.handle).toBeNull();
  });
});
