import { render, screen, fireEvent } from '@testing-library/react';
import InventoryFab from '@/components/InventoryFab';

jest.mock('next/link', () => ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
  <a href={href} {...rest}>{children}</a>
));
jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

describe('InventoryFab', () => {
  const originalAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'false';
    useSession.mockReturnValue({ status: 'authenticated' });
    useRouter.mockReturnValue({ pathname: '/inventory' });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = originalAuthDisabled;
  });

  it('starts closed, showing only the toggle', () => {
    render(<InventoryFab />);
    expect(screen.getByRole('button', { name: 'Add to inventory' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens to reveal the single-item and whole-shop options', () => {
    render(<InventoryFab />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to inventory' }));

    expect(screen.getByRole('link', { name: 'Add one item' })).toHaveAttribute(
      'href',
      '/inventory/scan',
    );
    expect(screen.getByRole('link', { name: 'Add a whole shop' })).toHaveAttribute(
      'href',
      '/inventory/shop',
    );
  });

  it('closes again when the toggle is clicked a second time', () => {
    render(<InventoryFab />);
    const toggle = screen.getByRole('button', { name: 'Add to inventory' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    render(<InventoryFab />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to inventory' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders nothing when unauthenticated', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });
    const { container } = render(<InventoryFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when session.error flags a dead token, even though status is authenticated', () => {
    useSession.mockReturnValue({ status: 'authenticated', data: { error: 'SessionExpired' } });
    const { container } = render(<InventoryFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    '/inventory/scan',
    '/inventory/shop',
    '/inventory/shop/process',
    '/inventory/shop/process/[uuid]',
  ])('hides itself on %s', (pathname) => {
    useRouter.mockReturnValue({ pathname });
    const { container } = render(<InventoryFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows in local dev when auth is disabled, regardless of session', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ status: 'unauthenticated' });
    render(<InventoryFab />);
    expect(screen.getByRole('button', { name: 'Add to inventory' })).toBeInTheDocument();
  });
});
