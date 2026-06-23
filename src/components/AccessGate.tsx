import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import styles from '@/components/AccessGate.module.scss';

type Access = { status: number };
type Me = { id: string; handle: string | null };

// Sync the reciplease-session cookie (from the NextAuth-held token) before
// probing, since the generic API proxy forwards whatever cookie the browser
// currently has — a freshly-signed-in browser may not have it yet.
const probe = async (url: string): Promise<Access> => {
  await fetch('/api/session-cookie');
  const res = await fetch(url);
  return { status: res.status };
};

const meFetcher = (url: string): Promise<Me | null> =>
  fetch(url).then((res) => (res.ok ? res.json() : null));

function Centered({ children }: { children: ReactNode }) {
  return <div className={styles.gate}>{children}</div>;
}

/**
 * Gates the app behind sign-in, the backend allowlist, and (for allowed users)
 * having set a handle.
 *
 * - Not signed in: redirect to /login (middleware also redirects here).
 * - Signed in: sync the reciplease-session cookie (see /api/session-cookie) then
 *   probe a backend endpoint that actually enforces the allowlist
 *   (`GET /api/houses`, via the generic API proxy — there's no synthetic
 *   `/api/access` anymore). A 200 renders the app; a 403 means the account is
 *   valid but not on the allowlist, so we show a "not allowed" notice. A 401
 *   means our token is missing/invalid even though NextAuth thinks we're signed
 *   in — this happens for sessions that predate the Reciplease-JWT exchange (no
 *   `account` event fires for an already-valid session, so it never got one) —
 *   so we send those back through /login too, which forces a fresh OAuth
 *   handshake and mints one.
 * - Allowed but no handle yet (checked fresh via /api/me, since the
 *   NextAuth-session-cached handle can be stale right after onboarding sets
 *   one): redirect to the one-time handle setup page instead of rendering
 *   children.
 *
 * Set NEXT_PUBLIC_AUTH_DISABLED=true to bypass entirely for local development.
 * NEXT_PUBLIC_FAKE_AUTH=true injects a fake session (see _app.tsx) — there's no
 * real bearer token, so skip the backend allowlist probe too.
 */
export default function AccessGate({ children }: { children: ReactNode }) {
  const authDisabled =
    process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true' ||
    process.env.NEXT_PUBLIC_FAKE_AUTH === 'true';
  const { data: session, status } = useSession({ required: !authDisabled });
  const router = useRouter();

  const { data, isLoading } = useSWR<Access>(
    !authDisabled && status === 'authenticated' ? '/api/houses' : null,
    probe,
  );

  const needsReauth =
    status === 'unauthenticated' || !!session?.error || data?.status === 401;

  useEffect(() => {
    if (!authDisabled && needsReauth) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [authDisabled, needsReauth, router]);

  const allowed = !authDisabled && status === 'authenticated' && data?.status === 200;
  const { data: me, isLoading: meLoading } = useSWR<Me | null>(
    allowed ? '/api/me' : null,
    meFetcher,
  );

  if (authDisabled) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return <Centered>Loading…</Centered>;
  }

  if (needsReauth) {
    return <Centered>Redirecting to sign in…</Centered>;
  }

  if (isLoading || !data) {
    return <Centered>Checking access…</Centered>;
  }

  if (data.status === 403) {
    return (
      <Centered>
        <h1>Not allowed</h1>
        <p>
          {session?.user?.handle
            ? `${session.user.handle} isn't on the Reciplease allowlist.`
            : "This account isn't on the Reciplease allowlist."}
        </p>
        <button onClick={() => signOut()}>Sign out</button>
      </Centered>
    );
  }

  if (meLoading || !me) {
    return <Centered>Checking access…</Centered>;
  }

  if (!me.handle) {
    router.replace('/onboarding/handle');
    return <Centered>Setting up your account…</Centered>;
  }

  return <>{children}</>;
}
