import { useActionState, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { hardNavigate } from '@/lib/navigate';

// Same post-login destination login.tsx defaults to when there's no explicit
// callbackUrl.
const HOME = '/recipes';

export default function OnboardingHandle() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [error, submit, submitting] = useActionState(async () => {
    if (!handle.trim()) return null;
    const res = await fetch('/api/me/handle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: handle.trim() }),
    });
    if (res.status === 409) return 'That handle is already taken.';
    if (!res.ok) return 'Something went wrong. Please try again.';
    // Full reload (not router.replace) so the new handle is read fresh: the
    // handle is cached in SWR (/api/me), and a client-side nav would let
    // AccessGate see the stale null handle and bounce straight back here — an
    // infinite onboarding loop.
    hardNavigate(HOME);
    return null;
  }, null);

  return (
    <>
      <Head>
        <title>Pick a handle · Reciplease</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#f6f3ec_0%,#efe7d6_100%)] p-8 font-sans dark:bg-[linear-gradient(160deg,#1b1a17_0%,#262420_100%)]">
        <section className="flex w-full max-w-96 flex-col items-center gap-4 rounded-2xl bg-white px-8 py-10 text-center shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:bg-[#2b2a26] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
          <h1 className="m-0 text-[2rem] font-bold tracking-tight">Reciplease</h1>
          <p className="m-0 text-[0.95rem] text-[#5f5a50] dark:text-[#b7b1a4]">
            One more thing — pick a handle. This is how you&apos;ll appear to others
            in your house.
          </p>

          {error && (
            <p className="m-0 w-full rounded-lg bg-[#fdecea] px-3 py-2.5 text-[0.85rem] text-[#9b2c1f]">
              {error}
            </p>
          )}

          <form action={submit} className="flex w-full flex-col gap-3">
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={30}
              placeholder="Pick a handle — letters, emoji, anything you like, up to 30 characters"
              aria-label="Handle"
              className="w-full rounded-lg border border-[#dadce0] px-3 py-3 text-[0.95rem] text-[#1f1f1f] dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1]"
            />
            <button
              type="submit"
              disabled={submitting || !handle.trim()}
              className="mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[0.95rem] font-medium text-[#1f1f1f] transition hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1] dark:hover:bg-[#3d3b35]"
            >
              {submitting ? 'Saving…' : 'Save handle'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
