import { useEffect } from 'react';
import { useAuthenticated } from '@/lib/useAuthenticated';
import type { components } from '@/types/generated/api';
import { isSuccessResponse } from '@/lib/apiClientMutator';
import {
  useFindAllHouses,
  useFindHouseMembers,
  useFindPendingHouseInvites,
  useFindAllApiKeys,
  useFindAllPendingPantryItems,
} from '@/types/generated/client';

export type House = components['schemas']['House'];
// `handle` is genuinely optional/nullable here — a member may not have set one.
export type HouseMember = components['schemas']['HouseMember'];
export type PendingInvite = components['schemas']['HouseInvite'];
export type ApiKey = components['schemas']['ApiKey'];
export type CreatedApiKey = components['schemas']['CreatedApiKey'];

export const HOUSE_COOKIE = 'reciplease-house-id';
// Mirrors org.reciplease.configuration.HouseAccess.HOUSE_HEADER on the backend.
export const HOUSE_HEADER = 'X-RCPLS-House-Id';

// In-memory mirror of the active house id. useActiveHouse() keeps this in sync
// the moment houses resolve, so apiFetch can attach the house header even if the
// reciplease-house-id cookie write hasn't landed yet (the two used to race, which
// 403'd every house-scoped call on the first load after sign-in). A holder object
// (mutated property, not a reassigned binding) so render stays pure.
const activeHouse: { id: string | undefined } = { id: undefined };

export function readHouseCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${HOUSE_COOKIE}=`))
    ?.split('=')[1];
}

export function writeHouseCookie(id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${HOUSE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}

// Attaches the active house as a header on house-scoped calls. (Auth itself is
// handled by the proxy, which decodes the NextAuth session cookie server-side —
// the client doesn't deal with tokens here.) Previously the BFF read the plain
// reciplease-house-id cookie server-side and translated it into this header; now
// that calls go through the generic proxy the browser sets it, falling back to
// the in-memory active house id so a not-yet-written cookie doesn't drop the
// header (which the backend 403s on).
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const houseId = readHouseCookie() ?? activeHouse.id;
  const headers = new Headers(init.headers);
  if (houseId && !headers.has(HOUSE_HEADER)) {
    headers.set(HOUSE_HEADER, houseId);
  }
  return fetch(url, { ...init, headers });
}

export function useHouses() {
  const authenticated = useAuthenticated();
  // Mirror AccessGate: with auth disabled (local dev) there's no NextAuth session to
  // wait for — fetch anyway, and let the proxy's RECIPLEASE_DEV_TOKEN (if set)
  // authenticate the call.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  const { data: response, error, ...rest } = useFindAllHouses({
    swr: { enabled: authenticated || authDisabled },
  });
  const data = response && isSuccessResponse(response) ? response.data : undefined;
  const responseError = response && !isSuccessResponse(response) ? response.data : undefined;
  return { data, error: error ?? responseError, ...rest };
}

// The house the X-RCPLS-House-Id cookie currently points at, resolved against
// the user's houses (falls back to the first house if the cookie is stale/unset).
// Resolving also persists the choice (cookie + in-memory mirror) so every
// house-scoped apiFetch sends a matching header — without this the fallback was
// display-only and the header was dropped, 403ing the call. The persistence runs
// in an effect (before the page's own data-fetch effect, since callers invoke
// useActiveHouse ahead of their useSWR), keeping render pure.
export function useActiveHouse(): House | undefined {
  const { data: houses } = useHouses();
  const resolved =
    houses && houses.length > 0
      ? houses.find((house) => house.id === readHouseCookie()) ?? houses[0]
      : undefined;
  // `resolved` is a fresh object every render (re-derived from `houses` above),
  // so depending on it directly would re-run this effect every render even
  // when the same house is still selected — depend on the primitive id instead.
  const resolvedId = resolved?.id;

  useEffect(() => {
    if (!resolvedId) return;
    activeHouse.id = resolvedId;
    if (resolvedId !== readHouseCookie()) writeHouseCookie(resolvedId);
  }, [resolvedId]);

  return resolved;
}

// Only owners can see/manage members and invites — gate the fetch on that so
// read-only members never even issue the (403-bound) request.
export function useHouseMembers() {
  const activeHouse = useActiveHouse();
  const { data: response, error, ...rest } = useFindHouseMembers({
    swr: { enabled: activeHouse?.role === 'OWNER' },
  });
  const data = response && isSuccessResponse(response) ? response.data : undefined;
  const responseError = response && !isSuccessResponse(response) ? response.data : undefined;
  return { data, error: error ?? responseError, ...rest };
}

export function usePendingInvites() {
  const activeHouse = useActiveHouse();
  const { data: response, error, ...rest } = useFindPendingHouseInvites({
    swr: { enabled: activeHouse?.role === 'OWNER' },
  });
  const data = response && isSuccessResponse(response) ? response.data : undefined;
  const responseError = response && !isSuccessResponse(response) ? response.data : undefined;
  return { data, error: error ?? responseError, ...rest };
}

export function useApiKeys() {
  const activeHouse = useActiveHouse();
  const { data: response, error, ...rest } = useFindAllApiKeys({
    swr: { enabled: activeHouse?.role === 'OWNER' },
  });
  const data = response && isSuccessResponse(response) ? response.data : undefined;
  const responseError = response && !isSuccessResponse(response) ? response.data : undefined;
  return { data, error: error ?? responseError, ...rest };
}

// NOTE (cache-key dedup): this used to share the SWR key
// `['/api/pantry/pending', activeHouse.id]` with the fetches on /pantry/shop
// and /pantry/shop/process, so mounting this in the header never added a
// second request on those pages. The generated `useFindAllPendingPantryItems`
// hook uses a fixed key (`getFindAllPendingPantryItemsKey()` = `/api/pantry/pending`,
// no house id) which doesn't match that array key, so this now issues its own
// request rather than deduping with those two pages. Those pages are out of
// scope for this migration; flagged per project decision to migrate anyway
// rather than block on it.
export function usePendingCapturedItemsCount(): number {
  const activeHouse = useActiveHouse();
  const { data: response } = useFindAllPendingPantryItems({
    swr: { enabled: Boolean(activeHouse) },
  });
  return response && isSuccessResponse(response) ? response.data.length : 0;
}
