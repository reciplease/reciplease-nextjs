// A full-page navigation (not a client-side router push). Used after sign-up /
// handle setup so the new membership + handle are read fresh, with no stale SWR
// or NextAuth-session caches — a client nav would let AccessGate see the old
// state and bounce the user around. Wrapped in a helper so it's mockable (jsdom
// doesn't implement window.location navigation).
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
