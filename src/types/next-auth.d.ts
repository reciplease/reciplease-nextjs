import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    // Surfaced to the client so it can prompt re-auth; raw tokens are never exposed.
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    idToken?: string;
    refreshToken?: string;
    // Unix seconds at which the id_token expires.
    expiresAt?: number;
    error?: string;
  }
}
