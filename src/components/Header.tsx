import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signIn, signOut } from 'next-auth/react';

// Hover/active use the secondary brand colour (navy) — the old near-white fill
// was too bright against the dark UI.
const navLink =
  'p-4 transition-colors duration-100 hover:bg-secondary hover:text-white active:bg-secondary active:text-white';
// Current page: partial brand-coral highlight (translucent fill + underline).
const navLinkActive =
  'bg-highlight/[0.18] shadow-[inset_0_-0.2rem_0_var(--color-highlight)]';

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
  const { pathname } = useRouter();

  // Mirror AccessGate/RecipeFab: local dev shows the nav even without a session.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  const showNav = authenticated || authDisabled;

  // A nav item is active on its own page and any nested route (e.g. /recipes/123).
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // `prevHref` adds the separator before all but the first item. The divider
  // turns primary when the item on either side of it is active.
  const linkClass = (href: string, prevHref?: string) => {
    const divider = prevHref
      ? ` border-l-2 ${
          isActive(href) || isActive(prevHref) ? 'border-highlight' : 'border-secondary'
        }`
      : '';
    return `${navLink}${divider}${isActive(href) ? ` ${navLinkActive}` : ''}`;
  };

  return (
    <header className="flex flex-wrap items-center justify-start mt-4 mb-8">
      <h1 className="flex-none">
        <Link href={'/'} aria-label="Reciplease home">
          {/* SVG so it stays crisp at any size; `unoptimized` serves it
              directly (Next's image optimizer rejects SVGs by default). */}
          <Image
            src="/reciplease-book.svg"
            alt="Reciplease"
            width={44}
            height={44}
            priority
            unoptimized
          />
        </Link>
      </h1>
      {showNav && (
        <nav className="flex justify-start ms-4">
          <Link href={'/recipes'} className={linkClass('/recipes')}>
            Recipes
          </Link>
          <Link href={'/inventory'} className={linkClass('/inventory', '/recipes')}>
            Inventory
          </Link>
          <Link href={'/planner'} className={linkClass('/planner', '/inventory')}>
            Planner
          </Link>
        </nav>
      )}
      <div className="ml-auto mr-8 flex items-center gap-3">
        {authenticated ? (
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
        )}
      </div>
    </header>
  );
}
