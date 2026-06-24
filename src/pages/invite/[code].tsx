import Metadata from '@/components/Metadata';
import { BACKEND_URL } from '@/lib/backend-url';
import { GetServerSidePropsContext } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { hardNavigate } from '@/lib/navigate';

type InvitePreview = { houseId: string; houseName: string };

const fetcher = (url: string): Promise<InvitePreview | null> =>
  fetch(url).then((res) => (res.ok ? res.json() : null));

interface Props {
  code: string;
  initialPreview: InvitePreview | null;
}

export default function InvitePage({ code, initialPreview }: Props) {
  const router = useRouter();
  const { status } = useSession();
  const {
    data: preview,
    error,
    isLoading,
  } = useSWR(`/api/invites/${code}`, fetcher, { fallbackData: initialPreview ?? undefined });

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // The sign-in link carries ?autoaccept=true so that accepting *by signing in*
  // completes without a second click. An already-signed-in visitor (no flag)
  // clicks Accept explicitly instead.
  const autoAccept = router.query.autoaccept === 'true';

  async function acceptInvite() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/invites/${code}/accept`, { method: 'POST' });
      if (!res.ok) {
        setAcceptError(
          res.status === 404
            ? 'This invite is invalid or has already been used.'
            : 'Something went wrong accepting this invite. Please try again.',
        );
        return;
      }
      // A brand-new user (signed up via this invite) has no handle yet, and
      // /recipes is public so it wouldn't prompt for one. Send them to the
      // handle setup; existing users with a handle go to the app. Full nav so
      // the freshly-minted membership/handle are read without stale caches.
      const me = await fetch('/api/me').then((r) => (r.ok ? r.json() : null));
      hardNavigate(me && !me.handle ? '/onboarding/handle' : '/recipes');
    } catch {
      setAcceptError('Something went wrong accepting this invite. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  // Auto-accept only when arriving back from sign-in (autoaccept flag set),
  // never for a visitor who was already logged in.
  useEffect(() => {
    if (autoAccept && status === 'authenticated' && preview && !accepting && !acceptError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      acceptInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept, status, preview]);

  if (isLoading || status === 'loading') {
    return (
      <>
        <Metadata title="Invite" description="Loading invite..." />
        <section>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !preview) {
    return (
      <>
        <Metadata title="Invalid Invite" description="This invite is invalid" />
        <section>
          <h3 className="mb-4 text-2xl font-semibold">Invalid invite</h3>
          <p>This invite link is invalid or has already been used.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata
        title={`You're invited to ${preview.houseName}`}
        description={`Join ${preview.houseName} on Reciplease to share recipes, plan meals, and manage pantry inventory together.`}
      />
      <section>
        <h3 className="mb-4 text-2xl font-semibold">You&apos;re invited to {preview.houseName}</h3>

        {status === 'unauthenticated' && (
          <>
            <p className="mb-4">Sign in to accept this invite.</p>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/invite/${code}?autoaccept=true`)}`}
              className="cursor-pointer underline"
            >
              Sign in
            </Link>
          </>
        )}

        {status === 'authenticated' && autoAccept && (
          <>
            <p className="mb-4">Joining {preview.houseName}…</p>
            {acceptError && (
              <p role="alert" className="mt-4 text-red-600">
                {acceptError}
              </p>
            )}
          </>
        )}

        {status === 'authenticated' && !autoAccept && (
          <>
            <p className="mb-4">Accept this invite to join {preview.houseName}.</p>
            <button onClick={acceptInvite} disabled={accepting} className="cursor-pointer">
              {accepting ? 'Joining…' : 'Accept invite'}
            </button>
            {acceptError && (
              <p role="alert" className="mt-4 text-red-600">
                {acceptError}
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

// Fetched server-side (rather than left to the client-only SWR call below) so the
// initial HTML already has the real house name and a friendly description — link
// preview bots (WhatsApp, Slack, iMessage, ...) don't run JS, so without this they'd
// only ever see the transient "Loading invite..." metadata.
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const code = context.params?.code as string;
  let initialPreview: InvitePreview | null = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/invites/${code}`);
    initialPreview = res.ok ? await res.json() : null;
  } catch {
    initialPreview = null;
  }

  return {
    props: { code, initialPreview },
  };
}
