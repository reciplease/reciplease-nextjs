import { render, screen, fireEvent } from '@testing-library/react';
import AccessGate from '@/components/AccessGate';

jest.mock('next-auth/react');
jest.mock('swr');

const useSession = require('next-auth/react').useSession as jest.Mock;
const signIn = require('next-auth/react').signIn as jest.Mock;
const signOut = require('next-auth/react').signOut as jest.Mock;
const useSWR = require('swr').default as jest.Mock;

describe('AccessGate', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    useSWR.mockReturnValue({ data: undefined, isLoading: false });
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
    expect(useSWR).toHaveBeenCalledWith(null, expect.any(Function));
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

  it('prompts Google sign-in when unauthenticated', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Please sign in to continue.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(signIn).toHaveBeenCalledWith('google');
  });

  it('prompts sign-in when the session has a refresh error', () => {
    useSession.mockReturnValue({ data: { error: 'RefreshAccessTokenError' }, status: 'authenticated' });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Please sign in to continue.')).toBeInTheDocument();
  });

  it('shows a checking-access message while the allowlist probe is loading', () => {
    useSession.mockReturnValue({ data: { user: { email: 'cook@example.com' } }, status: 'authenticated' });
    useSWR.mockReturnValue({ data: undefined, isLoading: true });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Checking access…')).toBeInTheDocument();
    expect(useSWR).toHaveBeenCalledWith('/api/access', expect.any(Function));
  });

  it('shows a not-allowed message with the user email when the allowlist probe returns 403', () => {
    useSession.mockReturnValue({ data: { user: { email: 'cook@example.com' } }, status: 'authenticated' });
    useSWR.mockReturnValue({ data: { status: 403 }, isLoading: false });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText("cook@example.com isn't on the Reciplease allowlist.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('shows a generic not-allowed message when there is no user email', () => {
    useSession.mockReturnValue({ data: { user: {} }, status: 'authenticated' });
    useSWR.mockReturnValue({ data: { status: 403 }, isLoading: false });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText("This Google account isn't on the Reciplease allowlist.")).toBeInTheDocument();
  });

  it('renders children when the allowlist probe succeeds', () => {
    useSession.mockReturnValue({ data: { user: { email: 'cook@example.com' } }, status: 'authenticated' });
    useSWR.mockReturnValue({ data: { status: 200 }, isLoading: false });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('App content')).toBeInTheDocument();
  });
});
