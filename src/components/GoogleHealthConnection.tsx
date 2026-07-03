import { useState } from 'react';
import { useRouter } from 'next/router';
import { useGoogleHealthConnection } from '@/lib/googleHealth';
import { apiFetch } from '@/lib/houses';

// Settings section for linking/unlinking Google Health. Connecting is a full
// page navigation (not a fetch) since /api/google-health/authorize needs to
// redirect the browser through Google's OAuth consent screen (incremental
// authorization on top of the same Google client NextAuth login uses);
// disconnecting is a plain DELETE through the generic proxy.
export default function GoogleHealthConnection() {
  const router = useRouter();
  const { data, isLoading, mutate } = useGoogleHealthConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set by the OAuth callback route (src/app/api/google-health/callback/route.ts)
  // redirecting back here with ?googleHealth=connected|error.
  const googleHealthStatus =
    typeof router.query.googleHealth === 'string' ? router.query.googleHealth : null;

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/google-health/connection', { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not disconnect Google Health. Please try again.');
        return;
      }
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="mb-8">
      <legend className="text-lg font-medium">Google Health</legend>
      <p className="mb-3 text-sm opacity-70">
        Link Google Health to log food you eat from your inventory straight to your food diary.
      </p>

      {googleHealthStatus === 'error' && (
        <p role="alert" className="mb-3 text-red-600">
          Could not connect Google Health. Please try again.
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
        // Plain <a>, not next/link: /api/google-health/authorize is a route
        // handler that 302s to Google's consent screen, not a Next page — a
        // client-side Link transition would never see that redirect.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/api/google-health/authorize"
          className="inline-block rounded border-2 border-secondary px-2 py-1 text-sm"
        >
          Link Google Health
        </a>
      )}
    </fieldset>
  );
}
