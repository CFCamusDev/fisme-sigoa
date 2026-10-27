import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { ApiError } from '@/lib/api-error';
import { getHealth } from './get-health';

describe('getHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and returns valid health response', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { status: 'ok' },
    });

    const result = await getHealth();
    expect(result).toEqual({ status: 'ok' });
    expect(apiClient.get).toHaveBeenCalledWith('/health');
  });

  it('throws validation error when backend response does not match schema', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { status: 'unexpected_status' },
    });

    await expect(getHealth()).rejects.toThrow();
  });

  it('propagates ApiError when apiClient request fails', async () => {
    const error = new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Fallo de red',
    });
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(error);

    await expect(getHealth()).rejects.toThrow(ApiError);
  });
});
