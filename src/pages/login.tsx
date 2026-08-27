import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { passkeySignInCredentials } from '@/lib/passkey';

// Minimal shape of the Google Identity Services API this page uses. See
// https://developers.google.com/identity/gsi/web/reference/js-reference
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          prompt(): void;
        };
      };
    };
  }
}

const PASSKEY_SIGNUP_LABEL = 'Create an account with a passkey';

// NextAuth appends ?error=… when a sign-in attempt fails; surface a friendly message.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: 'Access was denied. Your account may not be permitted.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again later.',
  Verification: 'That sign-in link is no longer valid. Please try again.',
  CredentialsSignin: `That passkey isn't recognised. If you don't have an account yet, use "${PASSKEY_SIGNUP_LABEL}" instead.`,
  default: 'Something went wrong while signing in. Please try again.',
};

function GoogleIcon() {
  return (
    <svg className='h-[18px] w-[18px]' viewBox='0 0 18 18' aria-hidden='true'>
      <path
        fill='#4285F4'
        d='M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z'
      />
      <path
        fill='#34A853'
        d='M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z'
      />
      <path
        fill='#FBBC05'
        d='M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z'
      />
      <path
        fill='#EA4335'
        d='M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58Z'
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      className='h-[18px] w-[18px]'
      viewBox='0 0 16 16'
      fill='currentColor'
      aria-hidden='true'
    >
      <path d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z' />
    </svg>
  );
}

function PasskeyIcon() {
  return (
    <svg
      className='h-[18px] w-[18px]'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <circle cx='9' cy='7' r='3.5' />
      <path d='M2 19c0-3 3-5 7-5s7 2 7 5' />
      <path d='M16 9h6' />
      <path d='M19 9v6' />
    </svg>
  );
}

export default function Login() {
  const router = useRouter();
  const callbackUrl =
    typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/recipes';
  const error = typeof router.query.error === 'string' ? router.query.error : undefined;
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState<'login' | 'signup' | null>(null);
  const [gsiReady, setGsiReady] = useState(false);

  useEffect(() => {
    const google = window.google;
    // window.google can be missing even once the script "loads" (e.g. blocked by an
    // extension/CSP after the network request itself succeeds) — the click handler
    // falls back to a normal OAuth redirect in that case.
    if (!gsiReady || !google) return;

    google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
      // Google Identity Services' Credentials provider (see auth-options.ts)
      // verifies this ID token server-side and mints our own session — the
      // browser never sees or trusts it beyond handing it off here.
      callback: (response) => {
        void signIn('google-onetap', { credential: response.credential, callbackUrl });
      },
    });
    // Shows the "Continue as [name]"/"Continue with Google account…" overlay for a
    // returning user already signed into Google in this browser, without waiting
    // for a click on the button.
    google.accounts.id.prompt();
  }, [gsiReady, callbackUrl]);

  function handleGoogleClick() {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      void signIn('google', { callbackUrl });
    }
  }

  // Unlike the OAuth buttons, the WebAuthn ceremony itself runs here in the browser before
  // signIn() — a cancelled/failed ceremony never reaches NextAuth, so it can't surface via the
  // usual ?error= redirect and needs its own local error state.
  async function handlePasskey(mode: 'login' | 'signup') {
    setPasskeyError(null);
    setPasskeyBusy(mode);
    try {
      const result = await passkeySignInCredentials(mode);
      if (!result.ok) {
        setPasskeyError(result.error);
        return;
      }
      await signIn('passkey', { mode: result.mode, challenge: result.challenge, credential: result.credential, callbackUrl });
    } finally {
      setPasskeyBusy(null);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in · Reciplease</title>
      </Head>
      <main className='flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#f6f3ec_0%,#efe7d6_100%)] p-8 font-sans dark:bg-[linear-gradient(160deg,#1b1a17_0%,#262420_100%)]'>
        <section className='flex w-full max-w-96 flex-col items-center gap-4 rounded-2xl bg-white px-8 py-10 text-center shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:bg-[#2b2a26] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]'>
          <h1 className='m-0 text-[2rem] font-bold tracking-tight'>Reciplease</h1>
          <p className='m-0 text-[0.95rem] text-[#5f5a50] dark:text-[#b7b1a4]'>
            Your recipes and kitchen inventory, in one place.
          </p>

          {error && (
            <p className='m-0 w-full rounded-lg bg-[#fdecea] px-3 py-2.5 text-[0.85rem] text-[#9b2c1f]'>
              {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}
            </p>
          )}

          <Script
            src='https://accounts.google.com/gsi/client'
            strategy='afterInteractive'
            onLoad={() => setGsiReady(true)}
          />
          <button
            className='mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[0.95rem] font-medium text-[#1f1f1f] transition hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1] dark:hover:bg-[#3d3b35]'
            onClick={handleGoogleClick}
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <button
            className='inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[0.95rem] font-medium text-[#1f1f1f] transition hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1] dark:hover:bg-[#3d3b35]'
            onClick={() => signIn('github', { callbackUrl })}
          >
            <GithubIcon />
            Sign in with GitHub
          </button>

          <div className='my-1 flex w-full items-center gap-3 text-[0.75rem] text-[#8a8478] dark:text-[#908a7d]'>
            <span className='h-px flex-1 bg-[#dadce0] dark:bg-[#4a473f]' />
            or
            <span className='h-px flex-1 bg-[#dadce0] dark:bg-[#4a473f]' />
          </div>

          {passkeyError && (
            <p className='m-0 w-full rounded-lg bg-[#fdecea] px-3 py-2.5 text-[0.85rem] text-[#9b2c1f]'>
              {passkeyError}
            </p>
          )}

          <button
            className='inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[0.95rem] font-medium text-[#1f1f1f] transition hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1] dark:hover:bg-[#3d3b35]'
            disabled={passkeyBusy !== null}
            onClick={() => handlePasskey('login')}
          >
            <PasskeyIcon />
            {passkeyBusy === 'login' ? 'Signing in…' : 'Sign in with a passkey'}
          </button>

          <button
            className='inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[0.95rem] font-medium text-[#1f1f1f] transition hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1] dark:hover:bg-[#3d3b35]'
            disabled={passkeyBusy !== null}
            onClick={() => handlePasskey('signup')}
          >
            <PasskeyIcon />
            {passkeyBusy === 'signup' ? 'Creating account…' : PASSKEY_SIGNUP_LABEL}
          </button>
        </section>
      </main>
    </>
  );
}
