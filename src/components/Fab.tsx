import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthenticated } from '@/lib/useAuthenticated';

// Shared presentation/behaviour for the floating action buttons. Section-specific
// FABs (RecipeFab, PantryFab) wrap this with their own destination and label.
// Hidden when signed out and on the destination page itself.
export default function Fab({ href, label }: { href: string; label: string }) {
  const authenticated = useAuthenticated();
  const router = useRouter();

  // Mirror AccessGate: local dev bypasses the sign-in gate entirely.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

  if (!authDisabled && !authenticated) return null;
  if (router.pathname === href) return null;

  return (
    <Link href={href} aria-label={label} title={label} className="fab">
      {/* Large glyph lives here so the button's own font-size stays 1rem,
          keeping the `ch` in `right` aligned with the column's 80ch. */}
      <span className="-mt-0.5 text-3xl">+</span>
    </Link>
  );
}
