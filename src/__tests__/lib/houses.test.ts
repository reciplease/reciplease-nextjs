import { useHouseMembers, usePendingInvites } from '@/lib/houses';

jest.mock('swr');
jest.mock('next-auth/react');

const useSWR = require('swr').default;
const { useSession } = require('next-auth/react');

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
