import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GoogleHealthConnection from '@/components/GoogleHealthConnection';

jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('swr');

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this component migrated off hand-written apiFetch calls).
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

const { useSession } = require('next-auth/react');
const useRouter = require('next/router').useRouter as jest.Mock;
const useSWR = require('swr').default;

// The generated SWR hook (useFindGoogleHealthConnection) passes its key to
// `swr` as a thunk (`() => isEnabled ? [...] : null`), not a plain key —
// resolve it the same way the real `swr` package would before matching on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function setConnection(connected: boolean, mutate: jest.Mock = jest.fn()) {
  useSWR.mockImplementation((key: unknown) =>
    resolveKey(key) === null
      ? { data: undefined, isLoading: false, mutate: jest.fn() }
      : { data: { data: { connected }, status: 200, headers: new Headers() }, isLoading: false, mutate },
  );
}

beforeEach(() => {
  mockApiClientMutator.mockReset();
  useSession.mockReturnValue({ status: 'authenticated', data: {} });
  useRouter.mockReturnValue({ query: {} });
});

describe('GoogleHealthConnection', () => {
  it('offers to link when not connected', async () => {
    setConnection(false);
    render(<GoogleHealthConnection />);

    const link = await screen.findByRole('link', { name: 'Link Google Health' });
    expect(link).toHaveAttribute('href', '/api/google-health/authorize');
  });

  it('shows connected state with a disconnect button', async () => {
    setConnection(true);
    render(<GoogleHealthConnection />);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('disconnects and refreshes the connection status', async () => {
    const mutate = jest.fn();
    setConnection(true, mutate);
    mockApiClientMutator.mockResolvedValue({ data: undefined, status: 200, headers: new Headers() });
    render(<GoogleHealthConnection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/google-health/connection',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });

  it('shows an error when disconnecting returns a non-2xx response', async () => {
    setConnection(true);
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '2026-01-01T00:00:00.000Z', status: 500, error: 'Internal Server Error', path: '/api/google-health/connection' },
      status: 500,
      headers: new Headers(),
    });
    render(<GoogleHealthConnection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('shows an error when disconnecting rejects outright (network failure)', async () => {
    setConnection(true);
    mockApiClientMutator.mockRejectedValue(new Error('network error'));
    render(<GoogleHealthConnection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Could not disconnect Google Health. Please try again.')).toBeInTheDocument();
  });

  it('shows an error banner when the OAuth callback redirected back with an error', async () => {
    useRouter.mockReturnValue({ query: { googleHealth: 'error' } });
    setConnection(false);
    render(<GoogleHealthConnection />);

    expect(await screen.findByText('Could not connect Google Health. Please try again.')).toBeInTheDocument();
  });
});
