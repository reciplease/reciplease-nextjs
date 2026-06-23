import useSWR from 'swr';
import { useSession } from 'next-auth/react';

export type House = { id: string; name: string; role: 'OWNER' | 'READ_ONLY' };
export type HouseMember = { userId: string; handle: string | null; role: 'OWNER' | 'READ_ONLY' };
export type PendingInvite = { id: string; code: string; role: 'OWNER' | 'READ_ONLY'; createdAt: string };

export const HOUSE_COOKIE = 'reciplease-house-id';
// Mirrors org.reciplease.configuration.HouseAccess.HOUSE_HEADER on the backend.
export const HOUSE_HEADER = 'X-RCPLS-House-Id';

export function readHouseCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${HOUSE_COOKIE}=`))
    ?.split('=')[1];
}

// Attaches the active house as a header on every house-scoped backend call.
// Previously the BFF read the plain reciplease-house-id cookie server-side and
// translated it into this header; now that calls go straight through the
// generic proxy, the browser has to set it itself.
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const houseId = readHouseCookie();
  const headers = new Headers(init.headers);
  if (houseId && !headers.has(HOUSE_HEADER)) {
    headers.set(HOUSE_HEADER, houseId);
  }
  return fetch(url, { ...init, headers });
}

const fetcher = (url: string): Promise<House[]> =>
  fetch(url).then((res) => (res.ok ? res.json() : []));

export function useHouses() {
  const { status } = useSession();
  return useSWR<House[]>(
    status === 'authenticated' ? '/api/houses' : null,
    fetcher,
  );
}

// The house the X-RCPLS-House-Id cookie currently points at, resolved against
// the user's houses (falls back to the first house if the cookie is stale/unset).
export function useActiveHouse(): House | undefined {
  const { data: houses } = useHouses();
  if (!houses || houses.length === 0) return undefined;
  const cookieId = readHouseCookie();
  return houses.find((house) => house.id === cookieId) ?? houses[0];
}

const membersFetcher = (url: string): Promise<HouseMember[]> =>
  apiFetch(url).then((res) => (res.ok ? res.json() : []));

const invitesFetcher = (url: string): Promise<PendingInvite[]> =>
  apiFetch(url).then((res) => (res.ok ? res.json() : []));

// Only owners can see/manage members and invites — gate the fetch on that so
// read-only members never even issue the (403-bound) request.
export function useHouseMembers() {
  const activeHouse = useActiveHouse();
  return useSWR<HouseMember[]>(
    activeHouse?.role === 'OWNER' ? '/api/houses/members' : null,
    membersFetcher,
  );
}

export function usePendingInvites() {
  const activeHouse = useActiveHouse();
  return useSWR<PendingInvite[]>(
    activeHouse?.role === 'OWNER' ? '/api/houses/invites' : null,
    invitesFetcher,
  );
}
