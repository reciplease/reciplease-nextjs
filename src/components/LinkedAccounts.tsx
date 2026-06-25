import { useSession, signIn } from 'next-auth/react';
import { useState } from 'react';
import useSWR from 'swr';

type LinkedIdentity = { provider: string; email: string | null };
type Identities = { identities: LinkedIdentity[] };

const ALL_PROVIDERS: { id: 'google' | 'github'; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
];

const fetcher = async (url: string): Promise<Identities | null> => {
  const res = await fetch(url);
  return res.ok ? res.json() : null;
};

// The signed-in user's linked sign-in methods, with the ability to link another
// provider or unlink one (the backend refuses to remove the last). `returnTo` is
// where the OAuth link flow should land back after linking.
export default function LinkedAccounts({ returnTo }: { returnTo: string }) {
  const { data: session, status } = useSession();
  const { data: identities, isLoading, mutate } = useSWR<Identities | null>(
    status === 'authenticated' ? '/api/me/identities' : null,
    fetcher,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linked = identities?.identities ?? [];

  async function unlink(provider: string) {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch(`/api/me/identities/${provider}`, { method: 'DELETE' });
      if (res.status === 409) {
        setError("You can't remove your only sign-in method.");
        return;
      }
      if (!res.ok) {
        setError('Could not unlink that provider. Please try again.');
        return;
      }
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <fieldset className="mb-8">
      <legend className="text-lg font-medium">Sign-in methods</legend>
      <p className="mb-3 text-sm opacity-70">
        The accounts you can sign in with. Link another so you can sign in either way.
      </p>

      {session?.error === 'IdentityConflict' && (
        <p role="alert" className="mb-3 text-red-600">
          That account is already linked to a different Reciplease user.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm opacity-70">Loading…</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {ALL_PROVIDERS.map((provider) => {
            const linkedIdentity = linked.find((identity) => identity.provider === provider.id);
            const isLinked = linkedIdentity !== undefined;
            const isOnlyMethod = isLinked && linked.length === 1;
            return (
              <li key={provider.id} className="flex items-center justify-between gap-3">
                <span>
                  {provider.label}
                  {linkedIdentity?.email && (
                    <span className="ml-2 text-sm opacity-70">{linkedIdentity.email}</span>
                  )}
                </span>
                {isLinked ? (
                  <button
                    type="button"
                    aria-label={`Unlink ${provider.label}`}
                    disabled={isOnlyMethod || busy === provider.id}
                    title={isOnlyMethod ? "You can't remove your only sign-in method" : undefined}
                    onClick={() => unlink(provider.id)}
                    className="cursor-pointer rounded border-2 border-red-600 px-2 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === provider.id ? 'Unlinking…' : 'Unlink'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => signIn(provider.id, { callbackUrl: returnTo })}
                  >
                    Link {provider.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
