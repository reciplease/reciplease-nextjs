import Link from 'next/link';
import Logo from '@/components/Logo';
import { useActiveHouse } from '@/lib/houses';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
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

export default function Header() {
  const { data: session, status } = useSession();
  const authenticated = status === 'authenticated';
  const activeHouse = useActiveHouse();
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

  // Visible to any member of a house — the house switcher now lives on this page
  // too, and read-only members still need a way to switch houses, even though
  // member/invite management there is owner-only.
  const houseSettingsLink = activeHouse ? (
    <Link
      href={'/settings/house'}
      aria-label="House settings"
      className={`transition-colors duration-100 hover:text-secondary${
        isActive('/settings/house') ? ' text-secondary' : ''
      }`}
    >
      {/* House icon */}
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
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
      </svg>
    </Link>
  ) : null;

  // Sign out lives on /settings/house now, alongside the rest of the account/
  // house controls — the header just shows who's signed in.
  const authControls = authenticated ? (
    session.user?.handle && (
      <span className="text-[0.85rem] opacity-70">{session.user.handle}</span>
    )
  ) : (
    <Link
      href="/login"
      className="flex h-10 cursor-pointer items-center rounded border border-[#747775] bg-white px-3 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f7f8f8]"
    >
      Sign in
    </Link>
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
        {houseSettingsLink}
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
