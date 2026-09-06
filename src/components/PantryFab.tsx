import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// FAB for the pantry section. Unlike the single-destination Fab, this one
// expands into two options: pencil = add a single item via the scan wizard,
// trolley = capture a whole shopping trip for later processing.
export default function PantryFab() {
  // Plain status check, not useAuthenticated()/session.error-aware: every page
  // this renders on (/pantry/*) is already behind proxy.ts's edge middleware,
  // which redirects an expired/errored session to /login before this component
  // can ever mount — so there's no stale-session case left to catch here.
  const { status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Mirror AccessGate: local dev bypasses the sign-in gate entirely.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

  if (!authDisabled && status !== 'authenticated') return null;
  // Hidden on the capture flows themselves (scan, shop and its processing
  // pages) — "add more items" is not a useful action mid-flow, and the fixed
  // button would sit over the processing list's row actions on small screens.
  if (router.pathname === '/pantry/scan' || router.pathname.startsWith('/pantry/shop')) return null;

  return (
    <>
      {/* Backdrop — tap anywhere off the menu to close. */}
      {open && (
        <div
          data-testid="pantry-fab-backdrop"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      {open && (
        <div className="fixed bottom-24 right-[max(1rem,calc(50vw_-_40ch))] z-50 flex flex-col items-end gap-3">
          <Link
            href="/pantry/scan"
            aria-label="Add one item"
            title="Add one item"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3"
          >
            <span className="rounded-full bg-black/70 px-3 py-1 text-sm text-white">Add one item</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-highlight text-xl text-white shadow-lg transition hover:scale-110 active:scale-95">
              ✏️
            </span>
          </Link>
          <Link
            href="/pantry/shop"
            aria-label="Add a whole shop"
            title="Add a whole shop"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3"
          >
            <span className="rounded-full bg-black/70 px-3 py-1 text-sm text-white">Add a whole shop</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-highlight text-xl text-white shadow-lg transition hover:scale-110 active:scale-95">
              🛒
            </span>
          </Link>
        </div>
      )}

      <button
        type="button"
        aria-label="Add to pantry"
        aria-expanded={open}
        title="Add to pantry"
        onClick={() => setOpen((o) => !o)}
        className="fab"
      >
        {/* Large glyph lives here so the button's own font-size stays 1rem,
            keeping the `ch` in `right` aligned with the column's 80ch. */}
        <span className={`-mt-0.5 text-3xl transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
    </>
  );
}
