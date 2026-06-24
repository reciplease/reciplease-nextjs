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
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/components/HouseSwitcher', () => () => <div data-testid="house-switcher" />);

const { useActiveHouse, useHouseMembers, usePendingInvites } = require('@/lib/houses');

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('HouseSettingsPage', () => {
  it('shows the house switcher first, even for read-only members', () => {
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Test House', role: 'READ_ONLY' });
    useHouseMembers.mockReturnValue({ data: undefined, mutate: jest.fn() });
    usePendingInvites.mockReturnValue({ data: undefined, mutate: jest.fn() });

    render(<HouseSettingsPage />);

    expect(screen.getByTestId('house-switcher')).toBeInTheDocument();
  });

  it('shows an owners-only message for read-only members', () => {
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Test House', role: 'READ_ONLY' });
    useHouseMembers.mockReturnValue({ data: undefined, mutate: jest.fn() });
    usePendingInvites.mockReturnValue({ data: undefined, mutate: jest.fn() });

    render(<HouseSettingsPage />);

    expect(screen.getByText(/Only owners of Test House/)).toBeInTheDocument();
  });

  describe('as an owner', () => {
    const mutateMembers = jest.fn();
    const mutateInvites = jest.fn();

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
    });

    it('lists members with their roles', () => {
      render(<HouseSettingsPage />);

      expect(screen.getByText('owner-handle')).toBeInTheDocument();
      expect(screen.getByText('(no handle set)')).toBeInTheDocument();
    });

    it('shows the invite code for each pending invite', () => {
      render(<HouseSettingsPage />);

      expect(screen.getByText('abc123')).toBeInTheDocument();
    });

    it('updates a member role and revalidates the member list', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      render(<HouseSettingsPage />);

      const selects = screen.getAllByLabelText('Role');
      fireEvent.change(selects[1], { target: { value: 'OWNER' } });

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
        '/api/houses/members/member-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'OWNER' }) }),
      ));
      await waitFor(() => expect(mutateMembers).toHaveBeenCalled());
    });

    it('generates an invite, copies the link to the clipboard, and revalidates pending invites', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'invite-2', code: 'xyz789' }),
      });
      render(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Generate invite' }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
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
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      render(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
        '/api/houses/invites/invite-1',
        expect.objectContaining({ method: 'DELETE' }),
      ));
      await waitFor(() => expect(mutateInvites).toHaveBeenCalled());
    });

    it('shows an error message when updating a role fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      render(<HouseSettingsPage />);

      const selects = screen.getAllByLabelText('Role');
      fireEvent.change(selects[1], { target: { value: 'OWNER' } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not update/);
    });

    it('offers a remove (X) only for other members, and removing revalidates the list', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/me') return Promise.resolve({ ok: true, json: async () => ({ id: 'owner-1' }) });
        return Promise.resolve({ ok: true });
      });
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      renderFresh(<HouseSettingsPage />);

      // No remove button for yourself; one for the other member.
      const removeButtons = await screen.findAllByRole('button', { name: /^Remove/ });
      expect(removeButtons).toHaveLength(1);

      fireEvent.click(removeButtons[0]);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
        '/api/houses/members/member-1',
        expect.objectContaining({ method: 'DELETE' }),
      ));
      await waitFor(() => expect(mutateMembers).toHaveBeenCalled());
      confirmSpy.mockRestore();
    });
  });
});
