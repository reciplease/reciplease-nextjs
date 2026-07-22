import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import Header from '@/components/Header';

// next/image is mocked down to a plain <img> for jsdom — built via
// createElement (not JSX) so the next/next/no-img-element rule, which only
// flags real production <img> JSX, doesn't fire on this test-only stand-in.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => createElement('img', { alt }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
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

  it('shows the nav and the signed-in email when authenticated', () => {
    useSession.mockReturnValue({
      data: { user: { handle: 'cook' } },
      status: 'authenticated',
    });
    render(<Header />);
    for (const name of ['Recipes', 'Inventory', 'Planner']) {
      const link = screen.getByRole('link', { name });
      expect(link).toBeInTheDocument();
      // Each nav item carries an icon so the link still reads on mobile,
      // where the text label is hidden.
      expect(link.querySelector('svg')).not.toBeNull();
    }
    expect(screen.getByText('cook')).toBeInTheDocument();
  });

  it('hides the nav even though status is authenticated, when session.error flags a dead token', () => {
    // Regression: the cookie can still decode as "authenticated" for up to 30 days
    // after the embedded Reciplease JWT itself has expired — session.error is what
    // auth-options.ts sets once it notices that, and this must gate the nav too, or
    // it flashes "signed in" chrome for a token the backend will reject.
    useSession.mockReturnValue({
      data: { user: { handle: 'cook' }, error: 'SessionExpired' },
      status: 'authenticated',
    });
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Recipes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('hides the nav and shows a sign in link when unauthenticated', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Recipes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
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
    // The current route's link is marked aria-current="page"; others aren't.
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Recipes' })).not.toHaveAttribute('aria-current');
  });

  it('marks the settings link active on the settings page', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    useRouter.mockReturnValue({ pathname: '/settings' });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveClass('text-secondary');
  });

  it('keeps a recipe sub-route active on the Recipes tab', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    useRouter.mockReturnValue({ pathname: '/recipes/[recipeId]' });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
  });

  it('truncates the username rather than crowding the nav and settings', () => {
    useSession.mockReturnValue({
      data: { user: { handle: 'rhyssaldanha' } },
      status: 'authenticated',
    });
    render(<Header />);
    // `truncate` ellipsizes the handle (rhyssalda…) as the bar tightens, so
    // the nav icons and settings never lose space to it.
    expect(screen.getByText('rhyssaldanha')).toHaveClass('truncate');
  });
});
