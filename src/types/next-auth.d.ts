import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    // Only set by the passkey CredentialsProvider's authorize() — it already verified the
    // passkey and minted a Reciplease JWT directly, so the jwt callback adopts these rather
    // than running the OAuth /api/auth/exchange round trip.
    recipleaseToken?: string;
    // Only set alongside recipleaseToken on a fresh login (never on provider-linking,
    // where the backend returns refreshToken: null) — see jwt callback for how it's
    // adopted onto the token. Never surfaced on Session; see jwt.d.ts JWT below.
    recipleaseRefreshToken?: string;
    // Epoch milliseconds the refresh token above actually expires at (backend
    // ExchangeResponse.refreshTokenExpiresAt) — the authoritative source for how long
    // the session cookie should last, used in place of a hardcoded duration. See jwt.ts
    // JWT below and the [...nextauth] route wrapper, which applies it to the cookie.
    recipleaseRefreshTokenExpiresAt?: number;
    handle?: string | null;
  }

  interface Session {
    // The Reciplease JWT, used as the bearer token for backend API calls.
    accessToken?: string;
    // Surfaced to the client so it can prompt re-auth / show a link conflict,
    // e.g. "IdentityConflict" when linking a provider already claimed by
    // another account. Raw provider tokens are never exposed.
    error?: string;
    user?: {
      name?: string | null;
      image?: string | null;
      // The user-chosen handle; null until onboarding sets one.
      handle?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    // The Reciplease JWT minted by POST /api/auth/exchange; this is the
    // bearer credential for backend API calls, and also what's passed back
    // as `linkToken` when the user signs in with a second provider.
    recipleaseToken?: string;
    // The raw refresh token, mirrored out as a dedicated httpOnly `reciplease-refresh`
    // cookie by the [...nextauth] route wrapper (see route.ts) — never read by client
    // JS via session(), only ever round-tripped server-side through this JWE.
    recipleaseRefreshToken?: string;
    // Epoch milliseconds the refresh token above actually expires at — see
    // the matching field on User above for where it comes from and how it's used.
    recipleaseRefreshTokenExpiresAt?: number;
    userId?: string;
    handle?: string | null;
    error?: string;
  }
}
