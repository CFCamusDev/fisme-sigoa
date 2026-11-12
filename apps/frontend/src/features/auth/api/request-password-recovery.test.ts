import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/lib/api-error';
import { requestPasswordRecovery } from './request-password-recovery';

const validEmail = 'carlos.docente@untrm.edu.pe';
const mockSuccessResponse = { status: 'RECEIVED' };

describe('requestPasswordRecovery API (HU-005, T-005-09, D7)', () => {
  it('posts the email and parses the response', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockSuccessResponse, { status: 202 });
      }),
    );

    const result = await requestPasswordRecovery({ email: validEmail });

    expect(capturedBody).toEqual({ email: validEmail });
    expect(result).toEqual(mockSuccessResponse);
  });

  it('validates request payload before sending', async () => {
    let requestSent = false;
    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        requestSent = true;
        return HttpResponse.json(mockSuccessResponse, { status: 202 });
      }),
    );

    await expect(requestPasswordRecovery({ email: 'not-an-email' })).rejects.toThrow();
    expect(requestSent).toBe(false);
  });

  it('rejects a response that breaks the contract', async () => {
    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.json(
          {
            status: 'COMPLETED', // Inválido según ForgotPasswordResponse ({ status: 'RECEIVED' })
          },
          { status: 202 },
        );
      }),
    );

    await expect(requestPasswordRecovery({ email: validEmail })).rejects.toThrow();
  });

  it('keeps the code and status of a 429 RATE_LIMITED response', async () => {
    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Has excedido el límite de solicitudes.',
            },
          },
          { status: 429 },
        );
      }),
    );

    try {
      await requestPasswordRecovery({ email: validEmail });
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('RATE_LIMITED');
      expect(apiErr.status).toBe(429);
      expect(apiErr.message).toBe('Has excedido el límite de solicitudes.');
    }
  });

  it('sends a single request for simultaneous calls with the same normalized email (D7 dedupe)', async () => {
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', async () => {
        callCount++;
        await delay(50);
        return HttpResponse.json(mockSuccessResponse, { status: 202 });
      }),
    );

    const [res1, res2, res3] = await Promise.all([
      requestPasswordRecovery({ email: 'carlos.docente@untrm.edu.pe' }),
      requestPasswordRecovery({ email: '  CARLOS.DOCENTE@UNTRM.EDU.PE  ' }),
      requestPasswordRecovery({ email: 'Carlos.Docente@untrm.edu.pe' }),
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(mockSuccessResponse);
    expect(res2).toEqual(mockSuccessResponse);
    expect(res3).toEqual(mockSuccessResponse);
  });

  it('sends a new request after the previous one settled (D7 map cleanup on finally)', async () => {
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', async () => {
        callCount++;
        return HttpResponse.json(mockSuccessResponse, { status: 202 });
      }),
    );

    const first = await requestPasswordRecovery({ email: validEmail });
    expect(callCount).toBe(1);
    expect(first).toEqual(mockSuccessResponse);

    const second = await requestPasswordRecovery({ email: validEmail });
    expect(callCount).toBe(2);
    expect(second).toEqual(mockSuccessResponse);
  });
});
