import Router from 'next/router';
import { apiFetch } from '@/lib/houses';

// Used by pages that render without AccessGate (e.g. public recipe pages) so
// anonymous/expired-session visitors can still view public content. A 401 here
// means the resource genuinely requires sign-in (e.g. a private recipe) — redirect
// to login in that case only. Anything else (403 not-allowlisted, 404, network
// errors) is left to the caller's existing error handling.
export async function fetchOrRedirect<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (res.status === 401) {
    Router.replace(`/login?callbackUrl=${encodeURIComponent(Router.asPath)}`);
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status}`);
  }
  return res.json();
}
