import Link from 'next/link';
import Logo from '@/components/Logo';
import { useRouter } from 'next/router';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

// Hover/active use the secondary brand colour (navy) — the old near-white fill
// was too bright against the dark UI.
const navLink =
  'p-4 transition-colors duration-100 hover:bg-secondary hover:text-white active:bg-secondary active:text-white';
// Current page: brand-coral underline (no fill).
const navLinkActive =
  'shadow-[inset_0_-0.2rem_0_var(--color-highlight)]';

// The primary nav, shared between the desktop bar and the mobile menu.
const navItems = [
  { href: '/recipes', label: 'Recipes' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/planner', label: 'Planner' },
];

// Official "Sign in with Google" button per Google's branding guidelines
// (light theme): white surface, #747775 border, the 4-colour G mark, and the
// exact label. Tailwind utilities override the global button base style.
function GoogleSignInButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 cursor-pointer items-center gap-3 rounded border border-[#747775] bg-white px-3 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f7f8f8]"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      Sign in with Google
    </button>
  );
}

export default function Header() {
  const { data: session, status } = useSession();
  const authenticated = status === 'authenticated';
  const router = useRouter();
  const { pathname } = router;

  // Mobile menu (hamburger). Collapsed by default; closes on navigation so it
  // never lingers over a freshly loaded page.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const close = () => setMenuOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  // Mirror AccessGate/RecipeFab: local dev shows the nav even without a session.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  const showNav = authenticated || authDisabled;

  // A nav item is active on its own page and any nested route (e.g. /recipes/123).
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // `divider` adds the secondary-coloured separator before all but the first
  // item. Dividers only read on the horizontal desktop bar, so the mobile menu
  // opts out (stacked = false).
  const linkClass = (href: string, divider = false) =>
    `${navLink}${divider ? ' border-l-2 border-secondary' : ''}${
      isActive(href) ? ` ${navLinkActive}` : ''
    }`;

  const settingsLink = (
    <Link
      href={'/settings'}
      aria-label="Settings"
      className={`transition-colors duration-100 hover:text-secondary${
        isActive('/settings') ? ' text-secondary' : ''
      }`}
    >
      {/* Gear icon */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  );

  const authControls = authenticated ? (
    <>
      {session.user?.email && (
        <span className="text-[0.85rem] opacity-70">{session.user.email}</span>
      )}
      <button
        className="cursor-pointer whitespace-nowrap"
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        Sign out
      </button>
    </>
  ) : (
    <GoogleSignInButton onClick={() => signIn('google')} />
  );

  return (
    <header className="flex flex-wrap items-center justify-start mt-4 mb-8">
      <h1 className="flex-none">
        <Link href={'/'} aria-label="Reciplease home">
          {/* Inlined SVG so the cover can adopt the section accent colour
              (green on the inventory pages); see Logo.tsx. */}
          <Logo size={44} />
        </Link>
      </h1>

      {/* Desktop nav — collapses into the hamburger menu below the md breakpoint. */}
      {showNav && (
        <nav className="ms-4 hidden md:flex">
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={linkClass(item.href, i > 0)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="ml-auto mr-8 flex items-center gap-3">
        {settingsLink}

        {/* Desktop account controls. */}
        <div className="hidden items-center gap-3 md:flex">{authControls}</div>

        {/* Mobile hamburger — toggles the collapsed menu. */}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="border-none p-1 md:hidden"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu panel. `basis-full` makes it wrap onto its own row beneath
          the bar; hidden once the viewport reaches md. */}
      {menuOpen && (
        <div className="basis-full md:hidden">
          {showNav && (
            <nav className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={linkClass(item.href)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex flex-col items-start gap-3 p-4">{authControls}</div>
        </div>
      )}
    </header>
  );
}
