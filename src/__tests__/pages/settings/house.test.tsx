import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import HouseSettingsPage from '@/pages/settings/house';

// Fresh SWR cache so the /api/me lookup can't be polluted by another test.
const renderFresh = (node: ReactNode) =>
  render(<SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>);

jest.mock('@/lib/houses', () => ({
  useActiveHouse: jest.fn(),
  useHouseMembers: jest.fn(),
  usePendingInvites: jest.fn(),
  useApiKeys: jest.fn(),
}));

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this page migrated off hand-written apiFetch calls).
const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
  describeErrorStatus: (status: number) => {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "That couldn't be found.";
    if (status >= 400 && status < 500) return 'Please check your input and try again.';
    return 'Something went wrong. Please try again.';
  },
}));

jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/components/HouseSwitcher', () => () => <div data-testid="house-switcher" />);

const { useActiveHouse, useHouseMembers, usePendingInvites, useApiKeys } = require('@/lib/houses');

// Successful mutation responses with no interesting body (204, so the
// generated mutator never tries to json()-parse them).
function noContent() {
  return Promise.resolve({ data: undefined, status: 204, headers: new Headers() });
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  mockApiClientMutator.mockReset();
  // Default: /api/me resolves to nothing in particular; individual tests that
  // need a real identity override this.
  mockApiClientMutator.mockImplementation((url: string) =>
    url === '/api/me'
      ? Promise.resolve({ data: { id: 'owner-1' }, status: 200, headers: new Headers() })
      : noContent(),
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('HouseSettingsPage', () => {
  it('shows the house switcher first, even for read-only members', () => {
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Test House', role: 'READ_ONLY' });
    useHouseMembers.mockReturnValue({ data: undefined, mutate: jest.fn() });
    usePendingInvites.mockReturnValue({ data: undefined, mutate: jest.fn() });
    useApiKeys.mockReturnValue({ data: undefined, mutate: jest.fn() });

    renderFresh(<HouseSettingsPage />);

    expect(screen.getByTestId('house-switcher')).toBeInTheDocument();
  });

  it('shows an owners-only message for read-only members', () => {
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Test House', role: 'READ_ONLY' });
    useHouseMembers.mockReturnValue({ data: undefined, mutate: jest.fn() });
    usePendingInvites.mockReturnValue({ data: undefined, mutate: jest.fn() });
    useApiKeys.mockReturnValue({ data: undefined, mutate: jest.fn() });

    renderFresh(<HouseSettingsPage />);

    expect(screen.getByText(/Only owners of Test House/)).toBeInTheDocument();
  });

  describe('as an owner', () => {
    const mutateMembers = jest.fn();
    const mutateInvites = jest.fn();
    const mutateApiKeys = jest.fn();

    beforeEach(() => {
      useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Test House', role: 'OWNER' });
      useHouseMembers.mockReturnValue({
        data: [
          { userId: 'owner-1', handle: 'owner-handle', role: 'OWNER' },
          { userId: 'member-1', handle: null, role: 'READ_ONLY' },
        ],
        mutate: mutateMembers,
      });
      usePendingInvites.mockReturnValue({
        data: [{ id: 'invite-1', code: 'abc123', role: 'READ_ONLY', createdAt: '2026-01-01T00:00:00.000Z' }],
        mutate: mutateInvites,
      });
      useApiKeys.mockReturnValue({
        data: [{
          id: 'key-1',
          name: 'Home Assistant',
          role: 'READ_ONLY',
          keyPrefix: 'rcpl_abcdefghij',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: null,
        }],
        mutate: mutateApiKeys,
      });
    });

    it('lists members with their roles', () => {
      renderFresh(<HouseSettingsPage />);

      expect(screen.getByText('owner-handle')).toBeInTheDocument();
      expect(screen.getByText('(no handle set)')).toBeInTheDocument();
    });

    it('shows the invite code for each pending invite', () => {
      renderFresh(<HouseSettingsPage />);

      expect(screen.getByText('abc123')).toBeInTheDocument();
    });

    it('updates a member role and revalidates the member list', async () => {
      renderFresh(<HouseSettingsPage />);

      const selects = screen.getAllByLabelText('Role');
      fireEvent.change(selects[1], { target: { value: 'OWNER' } });

      await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/houses/members/member-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'OWNER' }) }),
      ));
      await waitFor(() => expect(mutateMembers).toHaveBeenCalled());
    });

    it('generates an invite, copies the link to the clipboard, and revalidates pending invites', async () => {
      mockApiClientMutator.mockImplementation((url: string) =>
        url === '/api/houses/invites'
          ? Promise.resolve({ data: { id: 'invite-2', code: 'xyz789' }, status: 200, headers: new Headers() })
          : noContent(),
      );
      renderFresh(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Generate invite' }));

      await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/houses/invites',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ role: 'READ_ONLY' }) }),
      ));
      await waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/xyz789`),
      );
      await waitFor(() => expect(mutateInvites).toHaveBeenCalled());
      expect(await screen.findByText('Link copied!')).toBeInTheDocument();
    });

    it('deletes a pending invite and revalidates the list', async () => {
      renderFresh(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/houses/invites/invite-1',
        expect.objectContaining({ method: 'DELETE' }),
      ));
      await waitFor(() => expect(mutateInvites).toHaveBeenCalled());
    });

    it('shows an error message when updating a role returns a non-2xx response', async () => {
      mockApiClientMutator.mockImplementation((url: string) =>
        url === '/api/houses/members/member-1'
          ? Promise.resolve({
              data: { timestamp: '2026-01-01T00:00:00.000Z', status: 400, error: 'Bad Request', path: url },
              status: 400,
              headers: new Headers(),
            })
          : noContent(),
      );
      renderFresh(<HouseSettingsPage />);

      const selects = screen.getAllByLabelText('Role');
      fireEvent.change(selects[1], { target: { value: 'OWNER' } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not update/);
    });

    it('shows an error message when updating a role rejects outright (network failure)', async () => {
      mockApiClientMutator.mockImplementation((url: string) =>
        url === '/api/houses/members/member-1'
          ? Promise.reject(new Error('network error'))
          : noContent(),
      );
      renderFresh(<HouseSettingsPage />);

      const selects = screen.getAllByLabelText('Role');
      fireEvent.change(selects[1], { target: { value: 'OWNER' } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not update/);
    });

    it('offers a remove (X) only for other members, and removing revalidates the list', async () => {
      mockApiClientMutator.mockImplementation((url: string) =>
        url === '/api/me'
          ? Promise.resolve({ data: { id: 'owner-1' }, status: 200, headers: new Headers() })
          : noContent(),
      );
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      renderFresh(<HouseSettingsPage />);

      // No remove button for yourself; one for the other member.
      const removeButtons = await screen.findAllByRole('button', { name: /^Remove/ });
      expect(removeButtons).toHaveLength(1);

      fireEvent.click(removeButtons[0]);

      await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/houses/members/member-1',
        expect.objectContaining({ method: 'DELETE' }),
      ));
      await waitFor(() => expect(mutateMembers).toHaveBeenCalled());
      confirmSpy.mockRestore();
    });

    it('shows existing API keys without exposing a raw secret', () => {
      renderFresh(<HouseSettingsPage />);

      expect(screen.getByText(/rcpl_abcdefghij…/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    });

    it('creates an API key, reveals the raw secret once, and revalidates the list', async () => {
      mockApiClientMutator.mockImplementation((url: string) =>
        url === '/api/houses/api-keys'
          ? Promise.resolve({
              data: { id: 'key-2', name: 'Grocery bot', role: 'READ_ONLY', rawKey: 'rcpl_rawsecretvalue1234' },
              status: 200,
              headers: new Headers(),
            })
          : noContent(),
      );
      renderFresh(<HouseSettingsPage />);

      fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'Grocery bot' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

      await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/houses/api-keys',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Grocery bot', role: 'READ_ONLY' }) }),
      ));
      expect(await screen.findByText('rcpl_rawsecretvalue1234')).toBeInTheDocument();
      await waitFor(() => expect(mutateApiKeys).toHaveBeenCalled());
    });

    it('revokes an API key and revalidates the list', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      renderFresh(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

      await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/houses/api-keys/key-1',
        expect.objectContaining({ method: 'DELETE' }),
      ));
      await waitFor(() => expect(mutateApiKeys).toHaveBeenCalled());
      confirmSpy.mockRestore();
    });

    it('does not revoke an API key when the confirmation is dismissed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      renderFresh(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

      expect(mockApiClientMutator).not.toHaveBeenCalledWith('/api/houses/api-keys/key-1', expect.anything());
      confirmSpy.mockRestore();
    });
  });
});
