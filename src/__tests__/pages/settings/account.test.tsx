import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountSettingsPage from '@/pages/settings/account';

jest.mock('@/components/Metadata', () => () => null);
jest.mock('next-auth/react');

const useSession = require('next-auth/react').useSession as jest.Mock;
const signIn = require('next-auth/react').signIn as jest.Mock;

global.fetch = jest.fn();

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (signIn as jest.Mock).mockReset();
  });

  it('lists Google as linked and offers to link GitHub when only Google is linked', async () => {
    useSession.mockReturnValue({ data: { accessToken: 'rcpls-jwt' } });
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ providers: ['google'] }),
    });

    render(<AccountSettingsPage />);

    await waitFor(() => expect(screen.getByText('Linked')).toBeInTheDocument());
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link GitHub' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/me/identities', {
      headers: { Authorization: 'Bearer rcpls-jwt' },
    });
  });

  it('starts a link flow for the missing provider', async () => {
    useSession.mockReturnValue({ data: { accessToken: 'rcpls-jwt' } });
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ providers: ['google'] }),
    });

    render(<AccountSettingsPage />);

    const linkButton = await screen.findByRole('button', { name: 'Link GitHub' });
    fireEvent.click(linkButton);

    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/settings/account' });
  });

  it('shows an identity-conflict error when the session carries one', () => {
    useSession.mockReturnValue({ data: { accessToken: 'rcpls-jwt', error: 'IdentityConflict' } });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ providers: ['google'] }) });

    render(<AccountSettingsPage />);

    expect(
      screen.getByText('That account is already linked to a different Reciplease user.'),
    ).toBeInTheDocument();
  });
});
