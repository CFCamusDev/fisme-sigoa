import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/lib/api-error';
import { resetPassword } from './reset-password';

const validToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const validPassword = 'NewStrongPassword2026*';
const mockSuccessResponse = { status: 'PASSWORD_RESET' };

describe('resetPassword API (HU-005, T-005-09, D7)', () => {
  it('posts the token and password and parses the response', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const result = await resetPassword({
      token: validToken,
      password: validPassword,
    });

    expect(capturedBody).toEqual({
      token: validToken,
      password: validPassword,
    });
    expect(result).toEqual(mockSuccessResponse);
  });

  it('validates request payload before sending', async () => {
    let requestSent = false;
    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        requestSent = true;
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    await expect(
      resetPassword({
        token: '',
        password: 'weak',
      }),
    ).rejects.toThrow();

    expect(requestSent).toBe(false);
  });

  it('rejects a response that breaks the contract', async () => {
    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        return HttpResponse.json(
          {
            status: 'COMPLETED', // Inválido según ResetPasswordResponse ({ status: 'PASSWORD_RESET' })
          },
          { status: 200 },
        );
      }),
    );

    await expect(
      resetPassword({
        token: validToken,
        password: validPassword,
      }),
    ).rejects.toThrow();
  });

  it('keeps the error code and status of INVALID_PASSWORD_RESET_TOKEN', async () => {
    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_PASSWORD_RESET_TOKEN',
              message: 'El enlace no es válido o venció.',
            },
          },
          { status: 400 },
        );
      }),
    );

    try {
      await resetPassword({
        token: validToken,
        password: validPassword,
      });
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
      expect(apiErr.status).toBe(400);
      expect(apiErr.message).toBe('El enlace no es válido o venció.');
    }
  });

  it('sends a single request for simultaneous calls with the same token (D7 in-flight promise sharing)', async () => {
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', async () => {
        callCount++;
        await delay(50);
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const [res1, res2, res3] = await Promise.all([
      resetPassword({ token: validToken, password: validPassword }),
      resetPassword({ token: validToken, password: validPassword }),
      resetPassword({ token: validToken, password: validPassword }),
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(mockSuccessResponse);
    expect(res2).toEqual(mockSuccessResponse);
    expect(res3).toEqual(mockSuccessResponse);
  });

  it('sends a new request after the previous one settled (D7 map cleanup on finally)', async () => {
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', async () => {
        callCount++;
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const first = await resetPassword({ token: validToken, password: validPassword });
    expect(callCount).toBe(1);
    expect(first).toEqual(mockSuccessResponse);

    const second = await resetPassword({ token: validToken, password: validPassword });
    expect(callCount).toBe(2);
    expect(second).toEqual(mockSuccessResponse);
  });
});
