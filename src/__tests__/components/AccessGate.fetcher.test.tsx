import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import AccessGate from '@/components/AccessGate';

jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

global.fetch = jest.fn();

// Each test gets its own fresh SWR cache (provider: () => new Map()) so one
// test's cached /api/houses or /api/me response can't leak into the next —
// SWR's cache is otherwise a module-level singleton shared across tests.
function renderGated(children: ReactNode) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <AccessGate>{children}</AccessGate>
    </SWRConfig>,
  );
}

describe('AccessGate access probe', () => {
  beforeEach(() => {
    useRouter.mockReturnValue({ replace: jest.fn(), pathname: '/recipes' });
  });

  afterEach(() => (fetch as jest.Mock).mockReset());

  it('probes /api/houses and /api/me and renders children once both resolve favourably', async () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/houses') return Promise.resolve({ status: 200 });
      if (url === '/api/me') {
        return Promise.resolve({ status: 200, json: async () => ({ id: 'user-1', handle: 'cook' }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    renderGated(<div>App content</div>);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('App content')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/houses');
    expect(fetch).toHaveBeenCalledWith('/api/me');
  });

  it('redirects to /onboarding/handle once /api/me resolves with no handle', async () => {
    const replace = jest.fn();
    useRouter.mockReturnValue({ replace, pathname: '/recipes' });
    useSession.mockReturnValue({ data: { user: { handle: null } }, status: 'authenticated' });
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/houses') return Promise.resolve({ status: 200 });
      if (url === '/api/me') {
        return Promise.resolve({ status: 200, json: async () => ({ id: 'user-1', handle: null }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    renderGated(<div>App content</div>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/handle'));
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });
});
