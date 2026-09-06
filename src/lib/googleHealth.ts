import { useSession } from 'next-auth/react';
import { useFindGoogleHealthConnection } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';
import type { components } from '@/types/generated/api';

export type GoogleHealthConnection = components['schemas']['GoogleHealthConnectionStatusDto'];

// Whether the current user has linked Google Health. Gated on session status
// like useHouses() — no point issuing the request while signed out.
export function useGoogleHealthConnection() {
  const { status } = useSession();
  // Mirror useHouses(): auth-disabled local dev has no session but may carry a
  // RECIPLEASE_DEV_TOKEN through the proxy.
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  const { data: response, error, ...rest } = useFindGoogleHealthConnection({
    swr: { enabled: status === 'authenticated' || authDisabled },
  });
  const data = response && isSuccessResponse(response) ? response.data : undefined;
  const responseError = response && !isSuccessResponse(response) ? response.data : undefined;
  return { data, error: error ?? responseError, ...rest };
}
