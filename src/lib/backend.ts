const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, init);
}
