import Link from 'next/link';
import Logo from '@/components/Logo';
import { useActiveHouse, usePendingCapturedItemsCount } from '@/lib/houses';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useAuthenticated } from '@/lib/useAuthenticated';

// Hover/active use the secondary brand colour (navy) — the old near-white fill
// was too bright against the dark UI.
const navLink =
  'p-3 md:p-4 transition-colors duration-100 hover:bg-secondary hover:text-white active:bg-secondary active:text-white';
// Current page: brand-coral underline (no fill).
const navLinkActive =
  'shadow-[inset_0_-0.2rem_0_var(--color-highlight)]';

const navIconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

// The primary nav — inline at every size: icon-only on mobile, icon + label
// from md up.
const navItems = [
  {
    href: '/recipes',
    label: 'Recipes',
    // Open book
    icon: (
      <svg {...navIconProps}>
        <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/pantry',
    label: 'Pantry',
    // Cupboard: cabinet with two doors and knobs
    icon: (
      <svg {...navIconProps}>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M12 3v18" />
        <path d="M9.5 11v2" />
        <path d="M14.5 11v2" />
      </svg>
    ),
  },
  {
    href: '/planner',
    label: 'Planner',
    // Calendar
    icon: (
      <svg {...navIconProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
];

export default function Header() {
  const { data: session } = useSession();
  const authenticated = useAuthenticated();
  const activeHouse = useActiveHouse();
  const pendingCapturedCount = usePendingCapturedItemsCount();
  const router = useRouter();
  const { pathname } = router;

  // Mirror AccessGate/RecipeFab: local dev shows the nav even without a session.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  const showNav = authenticated || authDisabled;

  // A nav item is active on its own page and any nested route (e.g. /recipes/123).
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // `divider` adds the secondary-coloured separator before all but the first
  // item. Dividers only read alongside the labels, so they're md-and-up only.
  const linkClass = (href: string, divider = false) =>
    `${navLink}${divider ? ' md:border-l-2 md:border-secondary' : ''}${
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

  // Visible to any member of the house the moment a captured shop is
  // waiting to be turned into pantry — one click straight to the process
  // page, from wherever in the app the user happens to be. Always the
  // pantry accent specifically (not bg-highlight, which follows whatever
  // section the user is currently browsing) — this pill is always about
  // pantry, regardless of which section's colour is active right now.
  const pendingCapturedLink = activeHouse && pendingCapturedCount > 0 ? (
    <Link
      href="/pantry/shop/process"
      aria-label={`${pendingCapturedCount} captured ${pendingCapturedCount === 1 ? 'item' : 'items'} to process`}
      title="Process captured items"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-pantry-highlight)] px-3 py-1 text-sm font-semibold text-white transition-colors hover:brightness-110"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
        <circle cx="9" cy="21" r="1" />
        <circle cx="18" cy="21" r="1" />
      </svg>
      <span>{pendingCapturedCount}</span>
    </Link>
  ) : null;

  // Sign out lives on /settings now, alongside the rest of the account
  // controls — the header just shows who's signed in. The handle truncates
  // away first when the bar gets tight; the nav icons and settings never give
  // up space for it.
  const authControls = authenticated && session ? (
    session.user?.handle && (
      <span className="min-w-0 truncate text-[0.85rem] opacity-70">
        {session.user.handle}
      </span>
    )
  ) : (
    <Link
      href="/login"
      // The global `a { color: inherit }` reset in main.css is unlayered, so
      // it beats Tailwind's utility layer — force this one with `!`, otherwise
      // the text inherits the header's light colour and disappears against
      // this button's white background.
      className="flex h-10 cursor-pointer items-center rounded border border-[#747775] bg-white px-3 text-sm font-medium !text-[#1f1f1f] transition-colors hover:bg-[#f7f8f8]"
    >
      Sign in
    </Link>
  );

  return (
    <header className="flex items-center justify-start mt-4 mb-8">
      <h1 className="flex-none">
        <Link href={'/'} aria-label="Reciplease home">
          {/* Inlined SVG so the cover can adopt the section accent colour
              (green on the pantry pages); see Logo.tsx. */}
          <Logo size={44} />
        </Link>
      </h1>

      {/* Primary nav — inline at every size: icon-only on mobile, icon + label
          from md up. */}
      {showNav && (
        <nav className="ms-2 flex shrink-0 md:ms-4">
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={linkClass(item.href, i > 0)}
            >
              <span className="flex items-center gap-2">
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
              </span>
            </Link>
          ))}
        </nav>
      )}

      {/* Right group. `min-w-0` lets the username inside truncate instead of
          forcing the bar wider; the icon links are `shrink-0` so the username
          always gives way first. */}
      <div className="ml-auto mr-8 flex min-w-0 items-center gap-3">
        {pendingCapturedLink}
        {authControls}

        <div className="flex shrink-0 items-center gap-3">
          {houseSettingsLink}
          {settingsLink}
        </div>
      </div>
    </header>
  );
}
