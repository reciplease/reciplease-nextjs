import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/houses';

// Hand-written rather than pulled from the generated OpenAPI types: the Fitbit
// backend endpoints haven't landed yet, so this is a reasonable contract to
// build the frontend against. Reconcile with `@/types/generated/api` once the
// backend ships and springdoc has a real schema for these.

export type FitbitConnection = { connected: boolean };

export type FitbitFoodUnit = {
  id: number;
  name: string;
};

export type FitbitFood = {
  foodId: number;
  name: string;
  brand?: string | null;
  units: FitbitFoodUnit[];
};

export type FitbitFoodLogRequest = {
  foodId: number;
  unitId: number;
  amount: number;
  mealTypeId: number;
  date: string;
};

// Fitbit's fixed meal type enum (Web API `mealTypeId`) — not a Reciplease
// concept, so this lives here rather than in a generated type.
export const MEAL_TYPES: { id: number; label: string }[] = [
  { id: 1, label: 'Breakfast' },
  { id: 2, label: 'Morning Snack' },
  { id: 3, label: 'Lunch' },
  { id: 4, label: 'Afternoon Snack' },
  { id: 5, label: 'Dinner' },
  { id: 7, label: 'Anytime' },
];

const connectionFetcher = (url: string): Promise<FitbitConnection> =>
  apiFetch(url).then((res) => (res.ok ? res.json() : { connected: false }));

// Whether the current user has linked Fitbit. Gated on session status like
// useHouses() — no point issuing the request while signed out.
export function useFitbitConnection() {
  const { status } = useSession();
  return useSWR<FitbitConnection>(
    status === 'authenticated' ? '/api/fitbit/connection' : null,
    connectionFetcher,
  );
}
