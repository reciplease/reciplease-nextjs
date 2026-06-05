import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// Floating action button that takes authenticated users to the recipe builder.
// Hidden when signed out and on the builder page itself.
export default function RecipeFab() {
  const { status } = useSession();
  const router = useRouter();

  // Mirror AccessGate: local dev bypasses the sign-in gate entirely.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

  if (!authDisabled && status !== 'authenticated') return null;
  if (router.pathname === '/recipes/new') return null;

  return (
    // Align the FAB's right edge to the content grid's right edge: the column is
    // min(80ch, 100vw - 2rem) centred, so its edge sits 50vw - 40ch from the
    // viewport's right. max(1rem, …) collapses to a 1rem gutter on narrow screens.
    <Link
      href="/recipes/new"
      aria-label="New recipe"
      title="New recipe"
      className="fixed bottom-6 right-[max(1rem,calc(50vw_-_40ch))] z-50 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-highlight leading-none text-white shadow-lg transition hover:bg-highlight/90 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-highlight/60 focus:ring-offset-2"
    >
      {/* Large glyph lives here so the button's own font-size stays 1rem,
          keeping the `ch` in `right` aligned with the column's 80ch. */}
      <span className="-mt-0.5 text-3xl">+</span>
    </Link>
  );
}
