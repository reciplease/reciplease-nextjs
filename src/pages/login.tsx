import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// NextAuth appends ?error=… when a sign-in attempt fails; surface a friendly message.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: 'Access was denied. Your Google account may not be permitted.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again later.',
  Verification: 'That sign-in link is no longer valid. Please try again.',
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

export default function Login() {
  const router = useRouter();
  const callbackUrl =
    typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/recipes';
  const error = typeof router.query.error === 'string' ? router.query.error : undefined;

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

          <button
            className='mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[0.95rem] font-medium text-[#1f1f1f] transition hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:border-[#4a473f] dark:bg-[#35332e] dark:text-[#e8e6e1] dark:hover:bg-[#3d3b35]'
            onClick={() => signIn('google', { callbackUrl })}
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <p className='m-0 text-[0.8rem] text-[#8a8478] dark:text-[#908a7d]'>
            Access is limited to allowlisted accounts.
          </p>
        </section>
      </main>
    </>
  );
}
