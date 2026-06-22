import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import styles from '@/components/AccessGate.module.scss';

type Access = { status: number };
type Me = { id: string; handle: string | null };

const probe = (url: string): Promise<Access> =>
  fetch(url).then((res) => ({ status: res.status }));

const meFetcher = (url: string): Promise<Me | null> =>
  fetch(url).then((res) => (res.ok ? res.json() : null));

function Centered({ children }: { children: ReactNode }) {
  return <div className={styles.gate}>{children}</div>;
}

/**
 * Gates the app behind sign-in, the backend allowlist, and (for allowed users)
 * having set a handle.
 *
 * - Not signed in: prompt login (middleware also redirects here).
 * - Signed in: probe the backend. A 200 renders the app; a 403 means the
 *   account is valid but not on the allowlist, so we show a "not allowed"
 *   notice.
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
    !authDisabled && status === 'authenticated' ? '/api/access' : null,
    probe,
  );

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

  if (status === 'unauthenticated' || session?.error) {
    return (
      <Centered>
        <h1>Reciplease</h1>
        <p>Please sign in to continue.</p>
        <button onClick={() => signIn('google')}>Sign in with Google</button>
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

  if (meLoading || !me) {
    return <Centered>Checking access…</Centered>;
  }

  if (!me.handle) {
    router.replace('/onboarding/handle');
    return <Centered>Setting up your account…</Centered>;
  }

  return <>{children}</>;
}
