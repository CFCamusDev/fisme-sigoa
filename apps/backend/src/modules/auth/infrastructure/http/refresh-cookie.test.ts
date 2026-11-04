import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from './refresh-cookie.js';

describe('refresh-cookie helpers (HU-002, Tramo 4, D1-D2)', () => {
  it('sets HttpOnly, Path /auth, Max-Age and the configured SameSite', () => {
    const mockCookie = vi.fn();
    const mockRes = {
      cookie: mockCookie,
    } as unknown as Response;

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setRefreshCookie(mockRes, 'sample-refresh-token-123', expiresAt, {
      sameSite: 'strict',
      isProduction: false,
    });

    expect(mockCookie).toHaveBeenCalledTimes(1);
    expect(mockCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'sample-refresh-token-123',
      expect.objectContaining({
        httpOnly: true,
        path: REFRESH_COOKIE_PATH,
        sameSite: 'strict',
        secure: false,
      }),
    );
  });

  it('adds Secure only in production', () => {
    const mockCookie = vi.fn();
    const mockRes = {
      cookie: mockCookie,
    } as unknown as Response;

    const expiresAt = new Date(Date.now() + 60000);

    // En desarrollo: secure: false
    setRefreshCookie(mockRes, 'token-dev', expiresAt, {
      sameSite: 'lax',
      isProduction: false,
    });
    expect(mockCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'token-dev',
      expect.objectContaining({ secure: false }),
    );

    // En producción: secure: true
    setRefreshCookie(mockRes, 'token-prod', expiresAt, {
      sameSite: 'none',
      isProduction: true,
    });
    expect(mockCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'token-prod',
      expect.objectContaining({ secure: true }),
    );
  });

  it('clears the cookie with the same path and httpOnly attributes', () => {
    const mockClearCookie = vi.fn();
    const mockRes = {
      clearCookie: mockClearCookie,
    } as unknown as Response;

    clearRefreshCookie(mockRes, {
      sameSite: 'strict',
      isProduction: true,
    });

    expect(mockClearCookie).toHaveBeenCalledTimes(1);
    expect(mockClearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        path: REFRESH_COOKIE_PATH,
        sameSite: 'strict',
        secure: true,
      }),
    );
  });

  it('reads the token among several cookies', () => {
    const mockReq = {
      headers: {
        cookie: 'sessionId=abc1234; sigoa_refresh_token=the-real-refresh-token; theme=dark',
      },
    } as unknown as Request;

    const token = readRefreshCookie(mockReq);
    expect(token).toBe('the-real-refresh-token');
  });

  it('returns null when the cookie is missing or empty', () => {
    // 1. Sin cabecera cookie
    expect(readRefreshCookie({ headers: {} } as Request)).toBeNull();

    // 2. Cabecera con otras cookies pero sin sigoa_refresh_token
    expect(
      readRefreshCookie({ headers: { cookie: 'other_token=xyz; theme=light' } } as Request),
    ).toBeNull();

    // 3. Cookie presente pero vacía
    expect(
      readRefreshCookie({ headers: { cookie: 'sigoa_refresh_token=; theme=light' } } as Request),
    ).toBeNull();
    expect(
      readRefreshCookie({ headers: { cookie: 'sigoa_refresh_token=   ' } } as Request),
    ).toBeNull();
  });
});
