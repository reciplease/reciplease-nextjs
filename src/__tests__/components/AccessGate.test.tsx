import { render, screen, fireEvent } from '@testing-library/react';
import AccessGate from '@/components/AccessGate';

jest.mock('next-auth/react');
jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const signOut = require('next-auth/react').signOut as jest.Mock;
const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

// useSWR is called twice (once for /api/access, once for /api/me); route each
// call to its own canned response by key so tests can control them
// independently.
function mockSWRByKey(
  responses: Record<string, { data?: unknown; isLoading: boolean; error?: unknown; mutate?: jest.Mock }>,
) {
  useSWR.mockImplementation((key: string | null) => {
    if (key && responses[key]) return { mutate: jest.fn(), ...responses[key] };
    return { data: undefined, isLoading: false, mutate: jest.fn() };
  });
}

describe('AccessGate', () => {
  const ORIGINAL_ENV = process.env;
  const replace = jest.fn();

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    replace.mockClear();
    useRouter.mockReturnValue({ replace, pathname: '/recipes', asPath: '/recipes' });
    mockSWRByKey({});
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('renders children directly when auth is disabled', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('App content')).toBeInTheDocument();
    expect(useSession).toHaveBeenCalledWith({ required: false });
  });

  it('renders children directly when fake auth is enabled', () => {
    process.env.NEXT_PUBLIC_FAKE_AUTH = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('shows a loading message while the session is loading', () => {
    useSession.mockReturnValue({ data: undefined, status: 'loading' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(replace).toHaveBeenCalledWith('/login?callbackUrl=%2Frecipes');
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('redirects to /login when the session has a refresh error', () => {
    useSession.mockReturnValue({ data: { error: 'RefreshAccessTokenError' }, status: 'authenticated' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(replace).toHaveBeenCalledWith('/login?callbackUrl=%2Frecipes');
  });

  it('redirects to /login when the allowlist probe 401s (stale pre-exchange session)', () => {
    useSession.mockReturnValue({ data: { user: {} }, status: 'authenticated' });
    mockSWRByKey({ 'access-gate:allowlist-probe': { data: { status: 401 }, isLoading: false } });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(replace).toHaveBeenCalledWith('/login?callbackUrl=%2Frecipes');
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('shows a checking-access message while the allowlist probe is loading', () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    mockSWRByKey({ 'access-gate:allowlist-probe': { data: undefined, isLoading: true } });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Checking access…')).toBeInTheDocument();
  });

  it('shows a retry message (not an indefinite spinner) when the allowlist probe errors', () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    const retryProbe = jest.fn();
    mockSWRByKey({
      'access-gate:allowlist-probe': { data: undefined, isLoading: false, error: new Error('network down'), mutate: retryProbe },
    });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.queryByText('Checking access…')).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn.t reach Reciplease/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryProbe).toHaveBeenCalled();
  });

  it('shows a retry message when /api/me errors after the allowlist probe succeeds', () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    const retryMe = jest.fn();
    mockSWRByKey({
      'access-gate:allowlist-probe': { data: { status: 200 }, isLoading: false },
      '/api/me': { data: undefined, isLoading: false, error: new Error('network down'), mutate: retryMe },
    });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.queryByText('Checking access…')).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn.t reach Reciplease/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryMe).toHaveBeenCalled();
  });

  it('shows a not-allowed message with the user handle when the allowlist probe returns 403', () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    mockSWRByKey({ 'access-gate:allowlist-probe': { data: { status: 403 }, isLoading: false } });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText("cook isn't on the Reciplease allowlist.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('shows a generic not-allowed message when there is no user handle', () => {
    useSession.mockReturnValue({ data: { user: {} }, status: 'authenticated' });
    mockSWRByKey({ 'access-gate:allowlist-probe': { data: { status: 403 }, isLoading: false } });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText("This account isn't on the Reciplease allowlist.")).toBeInTheDocument();
  });

  it('shows a checking-access message while /api/me is loading', () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    mockSWRByKey({
      'access-gate:allowlist-probe': { data: { status: 200 }, isLoading: false },
      '/api/me': { data: undefined, isLoading: true },
    });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Checking access…')).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('redirects to /onboarding/handle when /api/me reports no handle', () => {
    useSession.mockReturnValue({ data: { user: { handle: null } }, status: 'authenticated' });
    mockSWRByKey({
      'access-gate:allowlist-probe': { data: { status: 200 }, isLoading: false },
      '/api/me': { data: { id: 'user-1', handle: null }, isLoading: false },
    });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(replace).toHaveBeenCalledWith('/onboarding/handle');
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('renders children when the allowlist probe succeeds and /api/me reports a handle', () => {
    useSession.mockReturnValue({ data: { user: { handle: 'cook' } }, status: 'authenticated' });
    mockSWRByKey({
      'access-gate:allowlist-probe': { data: { status: 200 }, isLoading: false },
      '/api/me': { data: { id: 'user-1', handle: 'cook' }, isLoading: false },
    });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('App content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
