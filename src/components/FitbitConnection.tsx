import { useState } from 'react';
import { useRouter } from 'next/router';
import { useFitbitConnection } from '@/lib/fitbit';
import { apiFetch } from '@/lib/houses';

// Settings section for linking/unlinking Fitbit. Connecting is a full page
// navigation (not a fetch) since /api/fitbit/authorize needs to redirect the
// browser through Fitbit's OAuth consent screen; disconnecting is a plain
// DELETE through the generic proxy.
export default function FitbitConnection() {
  const router = useRouter();
  const { data, isLoading, mutate } = useFitbitConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set by the OAuth callback route (src/app/api/fitbit/callback/route.ts)
  // redirecting back here with ?fitbit=connected|error.
  const fitbitStatus = typeof router.query.fitbit === 'string' ? router.query.fitbit : null;

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/fitbit/connection', { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not disconnect Fitbit. Please try again.');
        return;
      }
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="mb-8">
      <legend className="text-lg font-medium">Fitbit</legend>
      <p className="mb-3 text-sm opacity-70">
        Link your Fitbit account to log food you eat from your inventory straight to Fitbit&apos;s food diary.
      </p>

      {fitbitStatus === 'error' && (
        <p role="alert" className="mb-3 text-red-600">
          Could not connect Fitbit. Please try again.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm opacity-70">Loading…</p>
      ) : data?.connected ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-highlight">Connected</span>
          <button
            type="button"
            disabled={busy}
            onClick={disconnect}
            className="cursor-pointer rounded border-2 border-red-600 px-2 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        // Plain <a>, not next/link: /api/fitbit/authorize is a route handler that
        // 302s to Fitbit's consent screen, not a Next page — a client-side Link
        // transition would never see that redirect.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/api/fitbit/authorize"
          className="inline-block rounded border-2 border-secondary px-2 py-1 text-sm"
        >
          Connect Fitbit
        </a>
      )}
    </fieldset>
  );
}
