import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import styles from '@/components/AccessGate.module.scss';
import type { components } from '@/types/generated/api';

type Access = { status: number };
// Augments the backend's Me shape with the fetch status code, so the gate can
// tell apart "no handle yet" (200) from "this token's user no longer exists" (404).
type Me = { status: number; handle: components['schemas']['Me']['handle'] };

// Distinct SWR key so this access probe does NOT share a cache entry with
// useHouses() (which also fetches /api/houses, in the Header on every page). If
// they collided, SWR would dedupe to a single fetcher and AccessGate could get
// useHouses' array shape instead of {status}, and hang on "Checking access".
const PROBE_KEY = 'access-gate:house-probe';

const probe = async (): Promise<Access> => {
  const res = await fetch('/api/houses');
  return { status: res.status };
};

// Returns the status alongside the handle so the gate can tell apart "no handle
// yet" (200) from "this token's user no longer exists" (404 — e.g. the account
// was deleted), which needs a fresh sign-in, not the handle page.
const meFetcher = async (url: string): Promise<Me> => {
  const res = await fetch(url);
  if (res.status === 200) {
    const body: components['schemas']['Me'] = await res.json();
    return { status: 200, handle: body.handle ?? null };
  }
  return { status: res.status, handle: null };
};

function Centered({ children }: { children: ReactNode }) {
  return <div className={styles.gate}>{children}</div>;
}

/**
 * Gates the app behind sign-in, the backend allowlist, and (for allowed users)
 * having set a handle.
 *
 * - Not signed in: redirect to /login (middleware also redirects here).
 * - Signed in: probe a backend endpoint that actually enforces the allowlist
 *   (`GET /api/houses`, via the generic API proxy, which authenticates the call
 *   from the NextAuth cookie server-side — there's no synthetic `/api/access`
 *   anymore). A 200 renders the app; a 403 means the account is valid but not on
 *   the allowlist, so we show a "not allowed" notice. A 401 means our token is
 *   missing/invalid even though NextAuth thinks we're signed in — so we send
 *   those back through /login, which forces a fresh OAuth handshake.
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

  const allowed = !authDisabled && status === 'authenticated' && data?.status === 200;
  const {
    data: me,
    error: meError,
    isLoading: meLoading,
    mutate: retryMe,
  } = useSWR<Me>(allowed ? '/api/me' : null, meFetcher);

  // A 404/401 from /api/me means the token's user no longer exists (deleted
  // account / stale session): a fresh sign-in re-creates the user, so treat it
  // like any other reauth case.
  const meStale = me?.status === 401 || me?.status === 404;
  const needsReauth =
    status === 'unauthenticated' || !!session?.error || data?.status === 401 || meStale;

  useEffect(() => {
    if (!authDisabled && needsReauth) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [authDisabled, needsReauth, router]);

  if (authDisabled) {
    return <>{children}</>;
  }

  // Every "still figuring out whether to show the app" state — session loading,
  // about to redirect to sign in, waiting on the allowlist/handle probes — renders
  // the exact same thing. These used to each show their own wording ("Loading…",
  // "Redirecting to sign in…", "Checking access…"), which on a single page load
  // reads as a sequence of different flashing popups rather than one smooth wait.
  if (status === 'loading' || needsReauth) {
    return <Centered>Loading…</Centered>;
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
    return <Centered>Loading…</Centered>;
  }

  if (data.status === 403) {
    return (
      <Centered>
        <h1>Not allowed</h1>
        <p>
          {session?.user?.handle
            ? `${session.user.handle} doesn't have access yet — you need an invite to a house.`
            : 'This account doesn’t have access yet — you need an invite to a house.'}
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
    return <Centered>Loading…</Centered>;
  }

  if (me.status === 200 && !me.handle) {
    router.replace('/onboarding/handle');
    return <Centered>Setting up your account…</Centered>;
  }

  return <>{children}</>;
}
