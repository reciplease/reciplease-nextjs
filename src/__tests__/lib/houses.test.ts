import { useHouseMembers, usePendingInvites, apiFetch } from '@/lib/houses';

jest.mock('swr');
jest.mock('next-auth/react');

const useSWR = require('swr').default;
const { useSession } = require('next-auth/react');

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    document.cookie = 'reciplease-house-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  });

  it('attaches the active house as a header when the cookie is set', async () => {
    document.cookie = 'reciplease-house-id=house-1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await apiFetch('/api/inventory');

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

describe('useHouseMembers / usePendingInvites', () => {
  beforeEach(() => {
    document.cookie = 'reciplease-house-id=house-1';
    useSWR.mockReturnValue({ data: undefined, error: undefined, mutate: jest.fn() });
  });

  afterEach(() => {
    document.cookie = 'reciplease-house-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  });

  it('does not fetch members or invites when the user has no active house', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({ data: undefined, error: undefined, mutate: jest.fn() }); // useHouses

    useHouseMembers();

    expect(useSWR).toHaveBeenLastCalledWith(null, expect.any(Function));
  });

  it('does not fetch members or invites when the active house role is READ_ONLY', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({
      data: [{ id: 'house-1', name: 'Test House', role: 'READ_ONLY' }],
      error: undefined,
      mutate: jest.fn(),
    });

    useHouseMembers();

    expect(useSWR).toHaveBeenLastCalledWith(null, expect.any(Function));
  });

  it('fetches members when the active house role is OWNER', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({
      data: [{ id: 'house-1', name: 'Test House', role: 'OWNER' }],
      error: undefined,
      mutate: jest.fn(),
    });

    useHouseMembers();

    expect(useSWR).toHaveBeenLastCalledWith('/api/houses/members', expect.any(Function));
  });

  it('fetches pending invites when the active house role is OWNER', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useSWR.mockReturnValueOnce({
      data: [{ id: 'house-1', name: 'Test House', role: 'OWNER' }],
      error: undefined,
      mutate: jest.fn(),
    });

    usePendingInvites();

    expect(useSWR).toHaveBeenLastCalledWith('/api/houses/invites', expect.any(Function));
  });
});
