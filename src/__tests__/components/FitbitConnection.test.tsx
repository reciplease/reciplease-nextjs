import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import FitbitConnection from '@/components/FitbitConnection';

jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const { useSession } = require('next-auth/react');
const useRouter = require('next/router').useRouter as jest.Mock;

global.fetch = jest.fn();

const renderFresh = (node: ReactNode) =>
  render(<SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>);

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  useSession.mockReturnValue({ status: 'authenticated', data: {} });
  useRouter.mockReturnValue({ query: {} });
});

describe('FitbitConnection', () => {
  it('offers to connect when not linked', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ connected: false }) });
    renderFresh(<FitbitConnection />);

    const link = await screen.findByRole('link', { name: 'Connect Fitbit' });
    expect(link).toHaveAttribute('href', '/api/fitbit/authorize');
  });

  it('shows connected state with a disconnect button', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ connected: true }) });
    renderFresh(<FitbitConnection />);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('disconnects and refreshes the connection status', async () => {
    let connected = true;
    (fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        connected = false;
        return Promise.resolve({ ok: true, json: async () => ({ connected }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ connected }) });
    });
    renderFresh(<FitbitConnection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/fitbit/connection', expect.objectContaining({ method: 'DELETE' })),
    );
    await screen.findByRole('link', { name: 'Connect Fitbit' });
  });

  it('shows an error when disconnecting fails', async () => {
    (fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve({ ok: false });
      return Promise.resolve({ ok: true, json: async () => ({ connected: true }) });
    });
    renderFresh(<FitbitConnection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Could not disconnect Fitbit. Please try again.')).toBeInTheDocument();
  });

  it('shows an error banner when the OAuth callback redirected back with an error', async () => {
    useRouter.mockReturnValue({ query: { fitbit: 'error' } });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ connected: false }) });
    renderFresh(<FitbitConnection />);

    expect(await screen.findByText('Could not connect Fitbit. Please try again.')).toBeInTheDocument();
  });
});
