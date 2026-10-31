// Thin client for the FastAPI backend (served under /api by the same origin, or proxied by Vite in dev).
export class NetworkError extends Error {}
export class ApiError extends Error {
  constructor(public status: number, public detail: any) {
    super(typeof detail === 'string' ? detail : detail?.code ?? JSON.stringify(detail));
  }
}

export const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '/api';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new NetworkError('offline');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.detail ?? data);
  return data as T;
}
