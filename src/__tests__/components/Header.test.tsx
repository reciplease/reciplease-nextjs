import { render, screen, fireEvent, act } from '@testing-library/react';
import Header from '@/components/Header';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
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
const signIn = require('next-auth/react').signIn as jest.Mock;

describe('Header', () => {
  const originalAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED;

  // Header subscribes to router.events to close the mobile menu on navigation.
  const events = { on: jest.fn(), off: jest.fn() };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'false';
    useRouter.mockReturnValue({ pathname: '/recipes', events });
    events.on.mockClear();
    events.off.mockClear();
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
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Planner' })).toBeInTheDocument();
    expect(screen.getByText('cook')).toBeInTheDocument();
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
    useRouter.mockReturnValue({ pathname: '/inventory', events });
    render(<Header />);
    // The current route's link is marked aria-current="page"; others aren't.
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Recipes' })).not.toHaveAttribute('aria-current');
  });

  it('marks the settings link active on the settings page', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    useRouter.mockReturnValue({ pathname: '/settings', events });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveClass('text-secondary');
  });

  it('keeps a recipe sub-route active on the Recipes tab', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    useRouter.mockReturnValue({ pathname: '/recipes/[recipeId]', events });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
  });

  it('starts the Google sign-in flow when "Sign in with Google" is clicked', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith('google');
  });

  it('toggles the mobile menu when the hamburger is clicked', () => {
    useSession.mockReturnValue({
      data: { user: { handle: 'cook' } },
      status: 'authenticated',
    });
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Opening the menu surfaces a second (stacked) copy of each nav link.
    expect(screen.getAllByRole('link', { name: 'Recipes' })).toHaveLength(2);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('link', { name: 'Recipes' })).toHaveLength(1);
  });

  it('closes the mobile menu on route change', () => {
    useSession.mockReturnValue({
      data: { user: { handle: 'cook' } },
      status: 'authenticated',
    });
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Menu' });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const onRouteChangeStart = events.on.mock.calls.find(
      ([event]) => event === 'routeChangeStart',
    )![1];
    act(() => onRouteChangeStart());

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
