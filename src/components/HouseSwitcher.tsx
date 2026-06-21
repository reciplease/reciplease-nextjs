import { useEffect } from 'react';
import { HOUSE_COOKIE, readHouseCookie, useHouses } from '@/lib/houses';

// Writes the active house as a cookie (so server-side BFF routes can forward it
// to the backend as X-RCPLS-House-Id) and reloads, since switching houses
// changes which inventory/recipes/planned-recipes every page should show —
// simpler and more robust than trying to re-fetch every consumer in place.
function selectHouse(houseId: string) {
  document.cookie = `${HOUSE_COOKIE}=${houseId}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

export default function HouseSwitcher() {
  const { data: houses } = useHouses();

  // Auto-select the only house a user belongs to, so single-house users (the
  // common case) never see a switcher at all.
  useEffect(() => {
    if (houses?.length === 1 && readHouseCookie() !== houses[0].id) {
      document.cookie = `${HOUSE_COOKIE}=${houses[0].id}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [houses]);

  if (!houses || houses.length <= 1) {
    return null;
  }

  const current = readHouseCookie() ?? houses[0].id;

  return (
    <select
      aria-label="Active house"
      value={current}
      onChange={(e) => selectHouse(e.target.value)}
      className="rounded border-2 border-secondary bg-transparent px-2 py-1 text-sm"
    >
      {houses.map((house) => (
        <option key={house.id} value={house.id}>
          {house.name}
        </option>
      ))}
    </select>
  );
}
