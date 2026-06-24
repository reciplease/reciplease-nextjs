import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import styles from '@/components/AccessGate.module.scss';
import { ensureSessionCookie } from '@/lib/sessionCookie';

type Access = { status: number };
type Me = { id: string; handle: string | null };

// Distinct SWR key so this allowlist probe does NOT share a cache entry with
// useHouses() (which also fetches /api/houses, in the Header on every page). If
// they collided, SWR would dedupe to a single fetcher and AccessGate could get
// useHouses' array shape instead of {status}, and hang on "Checking access".
const PROBE_KEY = 'access-gate:allowlist-probe';

// Sync the reciplease-session cookie (from the NextAuth-held token) before
// probing, since the generic API proxy forwards whatever cookie the browser
// currently has — a freshly-signed-in browser may not have it yet.
const probe = async (): Promise<Access> => {
  await ensureSessionCookie();
  const res = await fetch('/api/houses');
  return { status: res.status };
};

const meFetcher = async (url: string): Promise<Me> => {
  await ensureSessionCookie();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
};

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

  const {
    data,
    error: probeError,
    isLoading,
    mutate: retryProbe,
  } = useSWR<Access>(
    !authDisabled && status === 'authenticated' ? PROBE_KEY : null,
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
  const {
    data: me,
    error: meError,
    isLoading: meLoading,
    mutate: retryMe,
  } = useSWR<Me>(allowed ? '/api/me' : null, meFetcher);

  if (authDisabled) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return <Centered>Loading…</Centered>;
  }

  if (needsReauth) {
    return <Centered>Redirecting to sign in…</Centered>;
  }

  if (probeError) {
    return (
      <Centered>
        <p>Couldn&apos;t reach Reciplease. Check your connection and try again.</p>
        <button onClick={() => retryProbe()}>Try again</button>
      </Centered>
    );
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

  if (meError) {
    return (
      <Centered>
        <p>Couldn&apos;t reach Reciplease. Check your connection and try again.</p>
        <button onClick={() => retryMe()}>Try again</button>
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
