import { render, screen } from '@testing-library/react';
import Header from '@/components/Header';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

describe('Header', () => {
  const originalAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'false';
    useRouter.mockReturnValue({ pathname: '/recipes' });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = originalAuthDisabled;
  });

  it('shows the nav and a sign-out button when authenticated', () => {
    useSession.mockReturnValue({
      data: { user: { email: 'cook@example.com' } },
      status: 'authenticated',
    });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Planner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText('cook@example.com')).toBeInTheDocument();
  });

  it('hides the nav and shows the Google sign-in button when unauthenticated', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Recipes' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('still shows the nav in local dev when auth is disabled', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeInTheDocument();
  });

  it('marks the current route as active', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useRouter.mockReturnValue({ pathname: '/inventory' });
    render(<Header />);
    // The active highlight class is applied to the current route's link only.
    expect(screen.getByRole('link', { name: 'Inventory' }).className).toMatch(/bg-highlight/);
    expect(screen.getByRole('link', { name: 'Recipes' }).className).not.toMatch(/bg-highlight/);
  });

  it('keeps a recipe sub-route active on the Recipes tab', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    useRouter.mockReturnValue({ pathname: '/recipes/[recipeId]' });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Recipes' }).className).toMatch(/bg-highlight/);
  });
});
