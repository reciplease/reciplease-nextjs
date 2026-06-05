import { useSession, signIn, signOut } from 'next-auth/react';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import styles from '@/components/AccessGate.module.scss';

type Access = { status: number };

const probe = (url: string): Promise<Access> =>
  fetch(url).then((res) => ({ status: res.status }));

function Centered({ children }: { children: ReactNode }) {
  return <div className={styles.gate}>{children}</div>;
}

/**
 * Gates the app behind Google sign-in and the backend allowlist.
 *
 * - Not signed in: prompt Google login (middleware also redirects here).
 * - Signed in: probe the backend. A 200 renders the app; a 403 means the Google
 *   account is valid but not on the allowlist, so we show a "not allowed" notice.
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

  const { data, isLoading } = useSWR<Access>(
    !authDisabled && status === 'authenticated' ? '/api/access' : null,
    probe,
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
          {session?.user?.email
            ? `${session.user.email} isn't on the Reciplease allowlist.`
            : "This Google account isn't on the Reciplease allowlist."}
        </p>
        <button onClick={() => signOut()}>Sign out</button>
      </Centered>
    );
  }

  return <>{children}</>;
}
