import { describe, expect, it, vi } from 'vitest';
import { isTransientError, withRetry } from './retry.js';

describe('withRetry', () => {
  it('returns immediately on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const sleep = vi.fn();

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, sleep });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries transient errors with exponential backoff and succeeds', async () => {
    const transientError = Object.assign(new Error('503 Service Unavailable'), { status: 503 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue('recovered');

    const delays: number[] = [];
    const sleep = vi.fn().mockImplementation((ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    });

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 200,
      sleep,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    // Exponential backoff: baseDelayMs * 2^(attempt - 1)
    expect(delays).toEqual([200, 400]);
  });

  it('does not retry non-transient 4xx validation errors and fails fast', async () => {
    const validationError = Object.assign(new Error('422 Unprocessable Entity'), { status: 422 });
    const fn = vi.fn().mockRejectedValue(validationError);
    const sleep = vi.fn();

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, sleep })).rejects.toThrow(
      validationError,
    );

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws last error when all retry attempts are exhausted', async () => {
    const networkError = Object.assign(new Error('Network Timeout'), { code: 'ETIMEDOUT' });
    const fn = vi.fn().mockRejectedValue(networkError);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 50, sleep })).rejects.toThrow(
      networkError,
    );

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe('isTransientError', () => {
  it('identifies network error codes as transient', () => {
    expect(isTransientError({ code: 'ECONNRESET' })).toBe(true);
    expect(isTransientError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isTransientError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isTransientError({ code: 'EAI_AGAIN' })).toBe(true);
  });

  it('identifies 429 and 5xx HTTP statuses as transient', () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ statusCode: 429 })).toBe(true);
    expect(isTransientError({ status: 500 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ statusCode: 504 })).toBe(true);
  });

  it('identifies 4xx validation and auth statuses as non-transient', () => {
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 401 })).toBe(false);
    expect(isTransientError({ status: 403 })).toBe(false);
    expect(isTransientError({ status: 404 })).toBe(false);
    expect(isTransientError({ status: 422 })).toBe(false);
  });

  it('defaults unknown errors to transient for safety in mail delivery', () => {
    expect(isTransientError(new Error('Unknown generic error'))).toBe(true);
  });
});
