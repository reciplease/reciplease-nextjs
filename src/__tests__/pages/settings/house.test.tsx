import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HouseSettingsPage from '@/pages/settings/house';

jest.mock('@/lib/houses');
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/components/HouseSwitcher', () => () => <div data-testid="house-switcher" />);
jest.mock('next-auth/react');

const { useActiveHouse, useHouseMembers, usePendingInvites } = require('@/lib/houses');
const { signOut } = require('next-auth/react');

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

  it('signs out when "Sign out" is clicked, even for read-only members', () => {
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Test House', role: 'READ_ONLY' });
    useHouseMembers.mockReturnValue({ data: undefined, mutate: jest.fn() });
    usePendingInvites.mockReturnValue({ data: undefined, mutate: jest.fn() });

    render(<HouseSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
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

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/houses/members/member-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'OWNER' }),
      }));
      await waitFor(() => expect(mutateMembers).toHaveBeenCalled());
    });

    it('generates an invite, copies the link to the clipboard, and revalidates pending invites', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'invite-2', code: 'xyz789' }),
      });
      render(<HouseSettingsPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Generate invite' }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/houses/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'READ_ONLY' }),
      }));
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

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/houses/invites/invite-1', { method: 'DELETE' }));
      await waitFor(() => expect(mutateInvites).toHaveBeenCalled());
    });

    it('shows an error message when updating a role fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      render(<HouseSettingsPage />);

      const selects = screen.getAllByLabelText('Role');
      fireEvent.change(selects[1], { target: { value: 'OWNER' } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not update/);
    });
  });
});
