import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import LinkedAccounts from '@/components/LinkedAccounts';

jest.mock('next-auth/react');
const { useSession, signIn } = require('next-auth/react');

global.fetch = jest.fn();

const renderFresh = (node: ReactNode) =>
  render(<SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>);

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  (signIn as jest.Mock).mockReset();
  useSession.mockReturnValue({ status: 'authenticated', data: {} });
});

function mockIdentities(providers: string[]) {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ providers }) });
}

describe('LinkedAccounts', () => {
  it('offers to link the provider that is not yet linked', async () => {
    mockIdentities(['google']);
    renderFresh(<LinkedAccounts returnTo="/settings/house" />);

    const linkGithub = await screen.findByRole('button', { name: 'Link GitHub' });
    fireEvent.click(linkGithub);
    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/settings/house' });
  });

  it('lets you unlink a provider when more than one is linked', async () => {
    (fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve({ ok: true, json: async () => ({ providers: ['google'] }) });
      return Promise.resolve({ ok: true, json: async () => ({ providers: ['google', 'github'] }) });
    });
    renderFresh(<LinkedAccounts returnTo="/settings/house" />);

    const unlink = await screen.findByRole('button', { name: 'Unlink GitHub' });
    fireEvent.click(unlink);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/me/identities/github', { method: 'DELETE' }),
    );
  });

  it('disables unlink when it is the only sign-in method', async () => {
    mockIdentities(['google']);
    renderFresh(<LinkedAccounts returnTo="/settings/house" />);

    // Google is linked and is the only method → its unlink is disabled; GitHub shows Link.
    await screen.findByRole('button', { name: 'Link GitHub' });
    expect(screen.getByRole('button', { name: 'Unlink Google' })).toBeDisabled();
  });
});
