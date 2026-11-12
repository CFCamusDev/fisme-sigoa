export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  isTransient?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
]);

/**
 * Determina si un error es transitorio (red, saturación 429, o error de servidor 5xx)
 * o si es permanente (4xx de validación, credenciales incorrectas, etc.).
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return true;
  }

  const err = error as { code?: string; status?: number; statusCode?: number; name?: string };

  if (err.code && TRANSIENT_NETWORK_CODES.has(err.code)) {
    return true;
  }

  const status = err.status ?? err.statusCode;
  if (typeof status === 'number') {
    if (status === 429) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  return true;
}

/**
 * Ejecuta una operación asíncrona con reintentos y backoff exponencial (RS-073, RNF-033).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const checkTransient = options.isTransient ?? isTransientError;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isTransient = checkTransient(error);
      if (!isTransient || attempt >= maxAttempts) {
        throw error;
      }

      // Backoff exponencial: baseDelayMs * 2^(attempt - 1)
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
