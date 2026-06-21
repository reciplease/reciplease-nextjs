import Metadata from '@/components/Metadata';
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
}

export default function InvitePage({ code }: Props) {
  const router = useRouter();
  const { status } = useSession();
  const {
    data: preview,
    error,
    isLoading,
  } = useSWR(`/api/invites/${code}`, fetcher);

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
      <Metadata title="You're invited" description={`Join ${preview.houseName} on Reciplease`} />
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

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { code: context.params?.code },
  };
}
