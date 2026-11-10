import type { QuotaStatusSummary } from '../shared/types';
let csrf = '';
export function setCsrf(token: string) {
  csrf = token;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public payload?: { quota?: QuotaStatusSummary }
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  let lastError: ApiError | null = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Sprout-CSRF': csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      lastError = new ApiError(
        'Cannot reach server. Check your connection; your input has been kept.',
        0
      );
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw lastError;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401)
        window.dispatchEvent(new Event('sprout-session-expired'));

      // If it is a transient proxy or provider hiccup (502/503/504), retry once before throwing
      const isTransient = response.status >= 502 && response.status <= 504;
      if (isTransient && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      throw new ApiError(
        data?.message ||
          'The server could not complete this request. Your input has been kept. Please try again.',
        response.status,
        data?.code || data?.error,
        data
      );
    }
    return data as T;
  }

  throw (
    lastError ||
    new ApiError(
      'Cannot reach server. Check your connection; your input has been kept.',
      0
    )
  );
}
