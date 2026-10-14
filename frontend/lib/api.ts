import type { TraderSnapshot } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // credentials: 'include' sends the httpOnly session cookie. The token is never
    // visible to this code, so nothing here can leak it.
    res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Cannot reach the snapshot service');
  }
  if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'Session expired' : `Request failed (${res.status})`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  snapshot: () => request<TraderSnapshot>('/api/snapshot'),
  login: (email: string, password: string) =>
    request<void>('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};
