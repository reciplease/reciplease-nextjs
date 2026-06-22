/** @jest-environment node */
import { authOptions, exchangeIdentity } from '@/lib/auth-options';
import type { Account, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

global.fetch = jest.fn();

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

describe('exchangeIdentity', () => {
  it('sends provider, providerId, and linkToken to the backend and returns the token/userId/handle on success', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'rcpls-jwt', userId: 'user-1', handle: 'chef' }),
    });

    const result = await exchangeIdentity(
      { provider: 'github', providerAccountId: '12345' },
      'old-rcpls-jwt',
    );

    expect(result).toEqual({ ok: true, token: 'rcpls-jwt', userId: 'user-1', handle: 'chef' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/exchange'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Secret': expect.any(String) }),
        body: JSON.stringify({
          provider: 'github',
          providerId: '12345',
          linkToken: 'old-rcpls-jwt',
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
    );

    expect(result).toEqual({ ok: true, token: 'rcpls-jwt', userId: 'user-1', handle: null });
  });

  it('reports an IdentityConflict on a 409 (linking an identity already claimed)', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 409 });

    const result = await exchangeIdentity(
      { provider: 'github', providerAccountId: '12345' },
      'old-rcpls-jwt',
    );

    expect(result).toEqual({ ok: false, error: 'IdentityConflict' });
  });

  it('reports a generic ExchangeError on other non-2xx responses', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await exchangeIdentity(
      { provider: 'google', providerAccountId: 'sub-1' },
      undefined,
    );

    expect(result).toEqual({ ok: false, error: 'ExchangeError' });
  });

  it('reports an ExchangeError when the request throws', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const result = await exchangeIdentity(
      { provider: 'google', providerAccountId: 'sub-1' },
      undefined,
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
      json: async () => ({ token: 'rcpls-jwt', userId: 'user-1', handle: 'chef' }),
    });

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result).toMatchObject({
      reciplaseToken: 'rcpls-jwt',
      userId: 'user-1',
      handle: 'chef',
      error: undefined,
    });
  });

  it('passes the existing reciplaseToken on the token as linkToken (linking a 2nd provider)', async () => {
    const token = { reciplaseToken: 'existing-jwt', userId: 'user-1', handle: 'chef' } as JWT;
    const account = { provider: 'github', providerAccountId: '999' } as unknown as Account;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'existing-jwt', userId: 'user-1', handle: 'chef' }),
    });

    await jwt!({ token, account, user: undefined as never });

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.linkToken).toBe('existing-jwt');
  });

  it('sets an error on the token when the exchange fails, without crashing', async () => {
    const token = { reciplaseToken: 'existing-jwt' } as JWT;
    const account = { provider: 'github', providerAccountId: '999' } as unknown as Account;
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 409 });

    const result = await jwt!({ token, account, user: undefined as never });

    expect(result.error).toBe('IdentityConflict');
  });

  it('leaves the token untouched when there is no fresh account (subsequent requests)', async () => {
    const token = { reciplaseToken: 'existing-jwt', handle: 'chef' } as JWT;

    const result = await jwt!({ token, account: null, user: undefined as never });

    expect(result).toBe(token);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('session callback', () => {
  it('exposes the Reciplease JWT as accessToken and the handle on session.user', async () => {
    const token = { reciplaseToken: 'rcpls-jwt', handle: 'chef' } as unknown as JWT;
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
    const token = { reciplaseToken: 'rcpls-jwt' } as unknown as JWT;
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
