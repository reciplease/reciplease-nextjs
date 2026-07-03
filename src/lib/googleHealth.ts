import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/houses';

// Hand-written rather than pulled from the generated OpenAPI types: the Google
// Health backend endpoints haven't landed yet, so this is a reasonable contract
// to build the frontend against. Reconcile with `@/types/generated/api` once the
// backend ships and springdoc has a real schema for these.

export type GoogleHealthConnection = { connected: boolean };

// Google Health's nutrition search results — modelled loosely on the Fitbit
// food shape this replaces, but Google's resource naming is closer to
// `foodId`/`displayName` than Fitbit's `foodId`/`name`+`units`. Field names
// here are a best guess and will need reconciling once the backend contract
// is final.
export type GoogleHealthFood = {
  foodId: string;
  displayName: string;
  brand?: string | null;
};

export type GoogleHealthFoodLogRequest = {
  foodId: string;
  foodDisplayName: string;
  mealType: string;
  date: string;
  amount: number;
};

// Best guess at Google Health's meal type enum — needs verification against
// the live API once available (developers.google.com/health).
export const MEAL_TYPES: { value: string; label: string }[] = [
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'DINNER', label: 'Dinner' },
  { value: 'SNACK', label: 'Snack' },
];

const connectionFetcher = (url: string): Promise<GoogleHealthConnection> =>
  apiFetch(url).then((res) => (res.ok ? res.json() : { connected: false }));

// Whether the current user has linked Google Health. Gated on session status
// like useHouses() — no point issuing the request while signed out.
export function useGoogleHealthConnection() {
  const { status } = useSession();
  return useSWR<GoogleHealthConnection>(
    status === 'authenticated' ? '/api/google-health/connection' : null,
    connectionFetcher,
  );
}
