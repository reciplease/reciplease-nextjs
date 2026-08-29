import { apiFetch } from '@/lib/houses';

// Orval `client: 'swr'` custom mutator. Wraps apiFetch (which attaches the
// active house header — see src/lib/houses.ts) so generated hooks/functions
// get the same auth/header behaviour as the app's hand-written fetchers.
//
// Written without async/await: this file gets bundled by orval's internal
// esbuild pass targeting the project tsconfig's `target` (es5 here), and
// esbuild can't downlevel async functions to es5.
export function apiClientMutator<T>(url: string, options?: RequestInit): Promise<T> {
  return apiFetch(url, options).then(function (res) {
    if (!res.ok) {
      return res
        .text()
        .catch(function () {
          return '';
        })
        .then(function (body) {
          throw new Error(res.status + ' ' + res.statusText + (body ? ': ' + body : ''));
        });
    }
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

export default apiClientMutator;
