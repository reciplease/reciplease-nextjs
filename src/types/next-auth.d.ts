import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
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
    reciplaseToken?: string;
    userId?: string;
    handle?: string | null;
    error?: string;
  }
}
