import Metadata from '@/components/Metadata';
import { BACKEND_URL } from '@/lib/backend';
import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import useSWR from 'swr';
import { useEffect, useState } from 'react';

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
      router.push('/recipes');
    } catch {
      setAcceptError('Something went wrong accepting this invite. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  // Auto-accept once signed in, so there's no extra click after the Google redirect.
  useEffect(() => {
    if (status === 'authenticated' && preview && !accepting && !acceptError) {
      // intentional: triggers a one-time network request as soon as the user is
      // signed in, not derived render state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      acceptInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, preview]);

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
            <p className="mb-4">Sign in with Google to accept this invite.</p>
            <button
              onClick={() => signIn('google', { callbackUrl: `/invite/${code}` })}
              className="cursor-pointer"
            >
              Sign in with Google
            </button>
          </>
        )}

        {status === 'authenticated' && (
          <>
            <p className="mb-4">{accepting ? 'Joining…' : 'Accepting your invite…'}</p>
            {acceptError && (
              <p role="alert" className="text-red-600">
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
