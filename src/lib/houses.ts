import useSWR from 'swr';
import { useSession } from 'next-auth/react';

export type House = { id: string; name: string; role: 'OWNER' | 'READ_ONLY' };

export const HOUSE_COOKIE = 'reciplease-house-id';

export function readHouseCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${HOUSE_COOKIE}=`))
    ?.split('=')[1];
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
