import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { setSessionRefresher, tryRefreshAndRetry, type SessionRefresher } from './session-refresh';

describe('session-refresh library (T-002-10, CA1, CA3)', () => {
  let fakeClient: AxiosInstance;

  beforeEach(() => {
    setSessionRefresher(null);
    fakeClient = axios.create();
  });

  function createAxiosError(url: string, status = 401, isRetry = false): AxiosError {
    const config = {
      url,
      headers: {
        Authorization: 'Bearer expired-token',
      },
      _isRetry: isRetry,
    } as unknown as InternalAxiosRequestConfig & { _isRetry?: boolean };

    const error = new Error('Request failed with status code ' + status) as AxiosError;
    error.config = config;
    error.response = {
      status,
      data: { error: { code: 'UNAUTHORIZED', message: 'Token vencido' } },
      statusText: 'Unauthorized',
      headers: {},
      config,
    };
    error.isAxiosError = true;
    return error;
  }

  function createMockResponse<T>(data: T, status = 200): AxiosResponse<T> {
    return {
      data,
      status,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    };
  }

  it('behaves as before when no refresher is registered', () => {
    const error = createAxiosError('/some/protected-data');
    const result = tryRefreshAndRetry(error, fakeClient);
    expect(result).toBeNull();
  });

  it('never renews on 401 from login or refresh', () => {
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockResolvedValue(true),
    };
    setSessionRefresher(mockRefresher);

    const loginError = createAxiosError('/auth/login');
    expect(tryRefreshAndRetry(loginError, fakeClient)).toBeNull();

    const refreshError = createAxiosError('/auth/refresh');
    expect(tryRefreshAndRetry(refreshError, fakeClient)).toBeNull();

    expect(mockRefresher.refresh).not.toHaveBeenCalled();
  });

  it('refreshes the session on 401 and retries the request once (CA1)', async () => {
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockResolvedValue(true),
    };
    setSessionRefresher(mockRefresher);

    const error = createAxiosError('/data/metrics');
    const clientSpy = vi
      .spyOn(fakeClient, 'request')
      .mockResolvedValue(createMockResponse({ ok: true }));

    const promise = tryRefreshAndRetry(error, fakeClient);
    expect(promise).not.toBeNull();

    const result = await promise;
    expect(mockRefresher.refresh).toHaveBeenCalledTimes(1);
    expect(clientSpy).toHaveBeenCalledTimes(1);
    expect(result?.data).toEqual({ ok: true });
    // Cabecera previa eliminada para permitir nuevo token del interceptor
    expect(error.config?.headers.Authorization).toBeUndefined();
  });

  it('renews and repeats a logout whose access token expired', async () => {
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockResolvedValue(true),
    };
    setSessionRefresher(mockRefresher);

    const logoutError = createAxiosError('/auth/logout');
    const clientSpy = vi
      .spyOn(fakeClient, 'request')
      .mockResolvedValue(createMockResponse(null, 204));

    const promise = tryRefreshAndRetry(logoutError, fakeClient);
    expect(promise).not.toBeNull();

    const result = await promise;
    expect(mockRefresher.refresh).toHaveBeenCalledTimes(1);
    expect(clientSpy).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe(204);
  });

  it('shares a single refresh among concurrent 401 responses', async () => {
    let resolveRefresh!: (val: boolean) => void;
    const refreshPromise = new Promise<boolean>((resolve) => {
      resolveRefresh = resolve;
    });

    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockReturnValue(refreshPromise),
    };
    setSessionRefresher(mockRefresher);

    vi.spyOn(fakeClient, 'request').mockResolvedValue(createMockResponse({ success: true }));

    const err1 = createAxiosError('/api/resource-1');
    const err2 = createAxiosError('/api/resource-2');

    const promise1 = tryRefreshAndRetry(err1, fakeClient)!;
    const promise2 = tryRefreshAndRetry(err2, fakeClient)!;

    resolveRefresh(true);

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockRefresher.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not retry a request that already failed after renewing', () => {
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockResolvedValue(true),
    };
    setSessionRefresher(mockRefresher);

    const errorAlreadyRetried = createAxiosError('/some/endpoint', 401, true);
    const result = tryRefreshAndRetry(errorAlreadyRetried, fakeClient);

    expect(result).toBeNull();
    expect(mockRefresher.refresh).not.toHaveBeenCalled();
  });

  it('rejects with the original 401 when the refresher reports an invalid session (CA3)', async () => {
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockResolvedValue(false),
    };
    setSessionRefresher(mockRefresher);

    const error = createAxiosError('/protected/profile');
    const promise = tryRefreshAndRetry(error, fakeClient);

    await expect(promise).rejects.toBe(error);
  });

  it('propagates a network or 5xx failure of the refresh without closing the session', async () => {
    const networkError = new Error('Failed to fetch refresh');
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockRejectedValue(networkError),
    };
    setSessionRefresher(mockRefresher);

    const error = createAxiosError('/protected/profile');
    const promise = tryRefreshAndRetry(error, fakeClient);

    await expect(promise).rejects.toBe(networkError);
  });

  it('serializes the refresh with a web lock when available', async () => {
    const mockRefresher: SessionRefresher = {
      refresh: vi.fn().mockResolvedValue(true),
    };
    setSessionRefresher(mockRefresher);

    const requestSpy = vi.fn((_name: string, callback: () => Promise<boolean>) => callback());
    Object.defineProperty(navigator, 'locks', {
      value: { request: requestSpy },
      configurable: true,
    });

    vi.spyOn(fakeClient, 'request').mockResolvedValue(createMockResponse(null, 200));

    const error = createAxiosError('/some/url');
    await tryRefreshAndRetry(error, fakeClient);

    expect(requestSpy).toHaveBeenCalledWith('sigoa-session-refresh', expect.any(Function));
    expect(mockRefresher.refresh).toHaveBeenCalled();
  });
});
