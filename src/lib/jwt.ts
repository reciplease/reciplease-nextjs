// Decodes a JWT's claims without verifying the signature — never trust this for
// authorization, only for "is it even worth sending"/"should we try to refresh it
// yet" checks; the backend verifies the signature on every real use. Uses `atob`
// rather than `Buffer` so it works identically in both the Node runtime ([...nextauth]
// route) and the Edge runtime (proxy.ts middleware).
function decodeJwtPayload(jwt: string): Record<string, unknown> | undefined {
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** The JWT's `exp` claim in epoch milliseconds, or undefined if missing/unparseable. */
export function jwtExpiryMillis(jwt: string): number | undefined {
  const exp = decodeJwtPayload(jwt)?.exp;
  return typeof exp === 'number' ? exp * 1000 : undefined;
}

export function isJwtExpired(jwt: string): boolean {
  const expiryMillis = jwtExpiryMillis(jwt);
  return expiryMillis === undefined || expiryMillis <= Date.now();
}
