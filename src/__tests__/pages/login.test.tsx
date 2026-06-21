import { render, screen, fireEvent } from '@testing-library/react';
import Login from '@/pages/login';

jest.mock('next-auth/react', () => ({ signIn: jest.fn() }));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const { signIn } = require('next-auth/react');
const useRouter = require('next/router').useRouter as jest.Mock;

describe('Login page', () => {
  afterEach(() => (signIn as jest.Mock).mockReset());

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
    ['AccessDenied', 'Access was denied. Your Google account may not be permitted.'],
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
});
