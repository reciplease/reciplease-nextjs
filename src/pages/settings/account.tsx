import Metadata from '@/components/Metadata';
import { useSession, signIn } from 'next-auth/react';
import useSWR from 'swr';

type Identities = { providers: string[] };

const ALL_PROVIDERS: { id: 'google' | 'github'; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
];

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { data: identities, isLoading } = useSWR<Identities | null>(
    token ? '/api/me/identities' : null,
    (url: string) =>
      fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((res) =>
        res.ok ? res.json() : null,
      ),
  );

  const linked = new Set(identities?.providers ?? []);

  return (
    <>
      <Metadata title="Account settings" description="Manage linked sign-in providers" />
      <section>
        <h3 className="mb-6 text-2xl font-semibold">Account</h3>

        {session?.error === 'IdentityConflict' && (
          <p role="alert" className="mb-4 text-red-600">
            That account is already linked to a different Reciplease user.
          </p>
        )}

        <fieldset className="mb-8">
          <legend className="text-lg font-medium">Linked sign-in providers</legend>
          <p className="mb-3 text-sm opacity-70">
            Link a second provider so you can sign in either way.
          </p>

          {isLoading ? (
            <p className="text-sm opacity-70">Loading…</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {ALL_PROVIDERS.map((provider) => (
                <li key={provider.id} className="flex items-center justify-between gap-3">
                  <span>{provider.label}</span>
                  {linked.has(provider.id) ? (
                    <span className="text-sm text-highlight">Linked</span>
                  ) : (
                    <button
                      type="button"
                      className="cursor-pointer"
                      onClick={() =>
                        signIn(provider.id, { callbackUrl: '/settings/account' })
                      }
                    >
                      Link {provider.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </section>
    </>
  );
}
