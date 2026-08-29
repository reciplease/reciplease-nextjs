import { apiFetch } from '@/lib/houses';

// Orval `client: 'swr'` custom mutator. Wraps apiFetch (which attaches the
// active house header — see src/lib/houses.ts) so generated hooks/functions
// get the same auth/header behaviour as the app's hand-written fetchers.
//
// Contract: this mutator NEVER throws on an HTTP-level error (4xx/5xx). The
// backend's OpenAPI spec now documents real typed error responses (e.g.
// ErrorResponse for 400/401/403) alongside success responses on most
// operations, so Orval generates a discriminated union response type per
// operation (e.g. `findAllHousesResponse200 | findAllHousesResponse401 | ...`).
// To let callers actually use that union, we always resolve the full
// envelope `{ data, status, headers }` — whether the response was ok or
// not — and callers discriminate on `.status` themselves.
//
// The one thing that still causes a rejection is a genuine network-level
// failure: if apiFetch(...)/fetch() itself rejects (DNS failure, connection
// refused, etc. — i.e. no Response object was ever obtained), that
// rejection is allowed to propagate unchanged. Only the "got a Response,
// but it's a 4xx/5xx" case resolves instead of throwing.
//
// Written without async/await: this file gets bundled by orval's internal
// esbuild pass targeting the project tsconfig's `target` (es5 here), and
// esbuild can't downlevel async functions to es5.
export function apiClientMutator<T>(url: string, options?: RequestInit): Promise<T> {
  return apiFetch(url, options).then(function (res) {
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return {
        data: undefined,
        status: res.status,
        headers: res.headers,
      } as T;
    }
    return res.json().then(function (body) {
      return {
        data: body,
        status: res.status,
        headers: res.headers,
      } as T;
    });
  });
}

// The literal 2xx status codes success responses use across the generated client.
// Only 200 is actually emitted today (a separate, known springdoc limitation: it
// can't see through a controller's runtime `ResponseEntity.status(HttpStatus.CREATED)`
// call, so creates/deletes are all documented as 200 regardless of their real runtime
// status) — the rest are listed so this keeps working once that's fixed upstream,
// without needing every call site updated again.
type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206;

/**
 * A type predicate, not just a boolean check: true when a resolved apiClientMutator
 * envelope represents a successful HTTP response (2xx) — and in that branch, narrows
 * `response` to the success member(s) of its (generated, discriminated-by-`status`)
 * union type, so callers get `.data`'s real success shape for free, no manual
 * `as Extract<...>` cast needed. Every generated function/hook's response type is
 * exactly this kind of union (see the file-level comment above); an unsuccessful
 * response's `.data` is an ErrorResponse instead (or whatever the backend documents
 * for that status).
 */
export function isSuccessResponse<T extends { status: number }>(
  response: T,
): response is Extract<T, { status: SuccessStatus }> {
  return response.status >= 200 && response.status < 300;
}

/**
 * A reasonable default user-facing message for a failed response, keyed on status —
 * meant as the fallback a call site passes when it has nothing more specific to say
 * (e.g. a per-field validation message). The backend's ErrorResponse body
 * ({timestamp, status, error, path}) only carries a generic HTTP reason phrase (e.g.
 * "Bad Request"), not a caller-friendly one, so this exists to give a consistent,
 * better-than-"Bad Request" default across the app rather than every page inventing
 * its own generic "Failed. Please try again." for every status alike.
 */
export function describeErrorStatus(status: number): string {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That couldn't be found.";
  if (status >= 400 && status < 500) return 'Please check your input and try again.';
  return 'Something went wrong. Please try again.';
}

export default apiClientMutator;
