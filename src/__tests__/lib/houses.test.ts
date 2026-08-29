import { useHouses, useHouseMembers, usePendingInvites, apiFetch } from '@/lib/houses';

// These tests invoke the hooks directly (not via render) and only assert the SWR
// key, so stub useEffect to a no-op — useActiveHouse's cookie-persisting effect
// is irrelevant here and would otherwise throw outside a render.
jest.mock('react', () => ({ ...jest.requireActual('react'), useEffect: () => {} }));
jest.mock('swr');
jest.mock('next-auth/react');

const useSWR = require('swr').default;
const { useSession } = require('next-auth/react');

// The generated hooks (useFindAllHouses, useFindHouseMembers,
// useFindPendingHouseInvites, ...) pass their key to `swr` as a thunk
// (`() => isEnabled ? [...] : null`), not a plain key — resolve it the same
// way the real `swr` package would before matching on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function lastKey(): unknown {
  const [key] = useSWR.mock.calls[useSWR.mock.calls.length - 1];
  return resolveKey(key);
}

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    document.cookie = 'reciplease-house-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  });

  it('attaches the active house as a header when the cookie is set', async () => {
    document.cookie = 'reciplease-house-id=house-1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await apiFetch('/api/pantry');

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).get('X-RCPLS-House-Id')).toBe('house-1');
  });

  it('omits the header when there is no active house cookie', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await apiFetch('/api/houses');

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).has('X-RCPLS-House-Id')).toBe(false);
  });
});

describe('useHouses', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    useSWR.mockReset();
    useSWR.mockReturnValue({ data: undefined, error: undefined, mutate: jest.fn() });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('does not fetch houses while signed out', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });

    useHouses();

    expect(lastKey()).toBeNull();
  });

  it('fetches houses despite no session when auth is disabled (local dev with a dev token)', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ status: 'unauthenticated' });

    useHouses();

    expect(lastKey()).toEqual(['/api/houses']);
  });

  it('does not fetch houses when session.error flags a dead token, even though status is authenticated', () => {
    useSession.mockReturnValue({ status: 'authenticated', data: { error: 'SessionExpired' } });

    useHouses();

    expect(lastKey()).toBeNull();
  });

  it('treats a non-2xx response as data-less and surfaces the error body', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValue({
      data: {
        data: { timestamp: '2026-01-01T00:00:00.000Z', status: 401, error: 'Unauthorized', path: '/api/houses' },
        status: 401,
        headers: new Headers(),
      },
      error: undefined,
      mutate: jest.fn(),
    });

    const result = useHouses();

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(
      expect.objectContaining({ status: 401, error: 'Unauthorized' }),
    );
  });
});

describe('useHouseMembers / usePendingInvites', () => {
  beforeEach(() => {
    document.cookie = 'reciplease-house-id=house-1';
    useSWR.mockReset();
    useSWR.mockReturnValue({ data: undefined, error: undefined, mutate: jest.fn() });
  });

  afterEach(() => {
    document.cookie = 'reciplease-house-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  });

  it('does not fetch members or invites when the user has no active house', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({ data: undefined, error: undefined, mutate: jest.fn() }); // useHouses

    useHouseMembers();

    expect(lastKey()).toBeNull();
  });

  it('does not fetch members or invites when the active house role is READ_ONLY', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({
      data: { data: [{ id: 'house-1', name: 'Test House', role: 'READ_ONLY' }], status: 200, headers: new Headers() },
      error: undefined,
      mutate: jest.fn(),
    });

    useHouseMembers();

    expect(lastKey()).toBeNull();
  });

  it('fetches members when the active house role is OWNER', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({
      data: { data: [{ id: 'house-1', name: 'Test House', role: 'OWNER' }], status: 200, headers: new Headers() },
      error: undefined,
      mutate: jest.fn(),
    });

    useHouseMembers();

    expect(lastKey()).toEqual(['/api/houses/members']);
  });

  it('fetches pending invites when the active house role is OWNER', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({
      data: { data: [{ id: 'house-1', name: 'Test House', role: 'OWNER' }], status: 200, headers: new Headers() },
      error: undefined,
      mutate: jest.fn(),
    });

    usePendingInvites();

    expect(lastKey()).toEqual(['/api/houses/invites']);
  });
});
