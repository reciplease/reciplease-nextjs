import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '@/pages/login';

jest.mock('next-auth/react', () => ({ signIn: jest.fn() }));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/passkey', () => ({ passkeySignInCredentials: jest.fn() }));

const { signIn } = require('next-auth/react');
const useRouter = require('next/router').useRouter as jest.Mock;
const { passkeySignInCredentials } = require('@/lib/passkey');

describe('Login page', () => {
  afterEach(() => {
    (signIn as jest.Mock).mockReset();
    (passkeySignInCredentials as jest.Mock).mockReset();
  });

  it('signs in with Google using the default callback url when none is provided', () => {
    useRouter.mockReturnValue({ query: {} });

    render(<Login />);

    expect(screen.getByRole('heading', { name: 'Reciplease' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/recipes' });
  });

  it('uses the callbackUrl from the query string when provided', () => {
    useRouter.mockReturnValue({ query: { callbackUrl: '/inventory' } });

    render(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/inventory' });
  });

  it('falls back to the default callback url when callbackUrl is not a string', () => {
    useRouter.mockReturnValue({ query: { callbackUrl: ['/inventory'] } });

    render(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/recipes' });
  });

  it('does not show an error message by default', () => {
    useRouter.mockReturnValue({ query: {} });

    render(<Login />);

    expect(screen.queryByText(/Access was denied/)).not.toBeInTheDocument();
  });

  it.each([
    ['AccessDenied', 'Access was denied. Your account may not be permitted.'],
    ['Configuration', 'Sign-in is temporarily unavailable. Please try again later.'],
    ['Verification', 'That sign-in link is no longer valid. Please try again.'],
    ['SomeUnknownError', 'Something went wrong while signing in. Please try again.'],
  ])('shows a friendly message for the %s error', (error, message) => {
    useRouter.mockReturnValue({ query: { error } });

    render(<Login />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('does not show an error message when the error query param is not a string', () => {
    useRouter.mockReturnValue({ query: { error: ['AccessDenied'] } });

    render(<Login />);

    expect(screen.queryByText(/Access was denied/)).not.toBeInTheDocument();
  });

  it('signs in with GitHub using the default callback url when none is provided', () => {
    useRouter.mockReturnValue({ query: {} });

    render(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));
    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/recipes' });
  });

  it('uses the callbackUrl from the query string for GitHub sign-in too', () => {
    useRouter.mockReturnValue({ query: { callbackUrl: '/inventory' } });

    render(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));
    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/inventory' });
  });

  it('signs in with a passkey using the result of the browser ceremony', async () => {
    useRouter.mockReturnValue({ query: {} });
    (passkeySignInCredentials as jest.Mock).mockResolvedValue({
      ok: true,
      mode: 'login',
      challenge: 'chal-1',
      credential: '{"id":"cred-1"}',
    });

    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /sign in with a passkey/i }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('passkey', {
        mode: 'login',
        challenge: 'chal-1',
        credential: '{"id":"cred-1"}',
        callbackUrl: '/recipes',
      }),
    );
    expect(passkeySignInCredentials).toHaveBeenCalledWith('login');
  });

  it('creates an account with a passkey using signup mode', async () => {
    useRouter.mockReturnValue({ query: {} });
    (passkeySignInCredentials as jest.Mock).mockResolvedValue({
      ok: true,
      mode: 'signup',
      challenge: 'chal-2',
      credential: '{"id":"cred-2"}',
    });

    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /create an account with a passkey/i }));

    await waitFor(() => expect(passkeySignInCredentials).toHaveBeenCalledWith('signup'));
    expect(signIn).toHaveBeenCalledWith('passkey', {
      mode: 'signup',
      challenge: 'chal-2',
      credential: '{"id":"cred-2"}',
      callbackUrl: '/recipes',
    });
  });

  it('shows an error and does not call signIn when the passkey ceremony fails', async () => {
    useRouter.mockReturnValue({ query: {} });
    (passkeySignInCredentials as jest.Mock).mockResolvedValue({ ok: false, error: 'Passkey sign-in was cancelled or failed.' });

    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /sign in with a passkey/i }));

    expect(await screen.findByText('Passkey sign-in was cancelled or failed.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
