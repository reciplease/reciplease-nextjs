// The backend authenticates via an HttpOnly `reciplease-session` cookie that the
// API proxy forwards verbatim (see src/app/api/[...proxy]/route.ts). That cookie
// is minted from the NextAuth session by GET /api/session-cookie — it does NOT
// exist until that endpoint has been hit at least once. So every authenticated
// /api/* call must ensure the cookie has been synced first, or the backend 401s.
//
// Memoised: the sync happens once per page load no matter how many fetchers need
// it (AccessGate's probe, useHouses, apiFetch, ...), and they all await the same
// in-flight promise rather than each doing their own round-trip. On failure the
// memo is cleared so a later call can retry.
let pending: Promise<void> | null = null;

export function ensureSessionCookie(): Promise<void> {
  if (!pending) {
    pending = fetch('/api/session-cookie')
      .then(() => undefined)
      .catch(() => {
        pending = null;
      });
  }
  return pending;
}

// Test seam: drop the memoised promise so each test starts clean.
export function resetSessionCookieForTests(): void {
  pending = null;
}
