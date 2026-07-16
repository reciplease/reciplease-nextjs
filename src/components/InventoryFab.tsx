import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// Positioning copied from Fab.tsx: align the FAB's right edge to the content
// grid's right edge (min(80ch, 100vw - 2rem) centred), collapsing to a 1rem
// gutter on narrow screens.
const FAB_RIGHT = 'right-[max(1rem,calc(50vw_-_40ch))]';

// FAB for the inventory section. Unlike the single-destination Fab, this one
// expands into two options: pencil = add a single item via the scan wizard,
// trolley = capture a whole shopping trip for later processing.
export default function InventoryFab() {
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
  if (router.pathname === '/inventory/scan' || router.pathname.startsWith('/inventory/shop')) return null;

  return (
    <>
      {/* Backdrop — tap anywhere off the menu to close. */}
      {open && (
        <div
          data-testid="inventory-fab-backdrop"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      {open && (
        <div className={`fixed bottom-24 ${FAB_RIGHT} z-50 flex flex-col items-end gap-3`}>
          <Link
            href="/inventory/scan"
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
            href="/inventory/shop"
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
        aria-label="Add to inventory"
        aria-expanded={open}
        title="Add to inventory"
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-6 ${FAB_RIGHT} z-50 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-highlight leading-none text-white shadow-lg transition transition-transform hover:scale-110 hover:bg-highlight/90 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-highlight/60 focus:ring-offset-2`}
      >
        {/* Large glyph lives here so the button's own font-size stays 1rem,
            keeping the `ch` in `right` aligned with the column's 80ch. */}
        <span className={`-mt-0.5 text-3xl transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
    </>
  );
}
