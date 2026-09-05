/**
 * Shared API fetch helper for the web app
 * Handles Bearer token headers, JSON formatting, and error parsing.
 */

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('/api') ? path : `/api/v1/internal${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.error || errJson.message || errorMsg;
    } catch {
      // ignore JSON parse error on non-JSON response
    }
    throw new Error(errorMsg);
  }

  // If response is empty or 204
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}
