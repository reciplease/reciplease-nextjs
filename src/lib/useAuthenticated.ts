import { useSession } from 'next-auth/react';

/**
 * Whether the current user is genuinely signed in and usable — not just whether
 * NextAuth's session cookie decodes. `status === 'authenticated'` alone doesn't
 * mean the embedded Reciplease JWT is still valid: the cookie can decode fine
 * while `session.error` (set by auth-options.ts's jwt callback once the token's
 * actually expired, or a sign-in exchange failed) says otherwise. Components
 * that render "signed in" chrome purely off `status` would show it for a beat
 * before AccessGate's own probe caught up and redirected — this closes that gap
 * by having every such component check the same thing AccessGate does.
 */
export function useAuthenticated(): boolean {
  const { status, data: session } = useSession();
  return status === 'authenticated' && !session?.error;
}
