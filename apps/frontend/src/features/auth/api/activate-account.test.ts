import { describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/lib/api-error';
import { activateAccount } from './activate-account';

const validToken = 'd7a4f9b2c3e1456789abcdef0123456789abcdef0123456789abcdef01234567';
const validPassword = 'Password123*';
const mockSuccessResponse = { status: 'ACTIVE' };

describe('activateAccount API (HU-004, T-004-09, D8)', () => {
  it('posts the token and password and parses the response', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/activate', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const result = await activateAccount({
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
      http.post('http://localhost:3000/auth/activate', () => {
        requestSent = true;
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    await expect(
      activateAccount({
        token: '',
        password: 'weak',
      }),
    ).rejects.toThrow();

    expect(requestSent).toBe(false);
  });

  it('rejects a response that breaks the contract', async () => {
    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(
          {
            status: 'PENDING_ACTIVATION', // Inválido según ActivateAccountResponse ({ status: 'ACTIVE' })
          },
          { status: 200 },
        );
      }),
    );

    await expect(
      activateAccount({
        token: validToken,
        password: validPassword,
      }),
    ).rejects.toThrow();
  });

  it('keeps the error code and status of INVALID_ACTIVATION_TOKEN', async () => {
    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_ACTIVATION_TOKEN',
              message: 'El enlace no es válido o venció.',
            },
          },
          { status: 400 },
        );
      }),
    );

    try {
      await activateAccount({
        token: validToken,
        password: validPassword,
      });
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('INVALID_ACTIVATION_TOKEN');
      expect(apiErr.status).toBe(400);
      expect(apiErr.message).toBe('El enlace no es válido o venció.');
    }
  });

  it('keeps the validation details of a weak password', async () => {
    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'La solicitud contiene errores de validación.',
              details: [
                {
                  path: 'body.password',
                  message:
                    'La contraseña debe tener al menos 10 caracteres y contener mayúsculas, minúsculas, números y un carácter especial.',
                },
              ],
            },
          },
          { status: 400 },
        );
      }),
    );

    try {
      await activateAccount({
        token: validToken,
        password: validPassword,
      });
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.status).toBe(400);
      expect(apiErr.details).toEqual([
        {
          path: 'body.password',
          message:
            'La contraseña debe tener al menos 10 caracteres y contener mayúsculas, minúsculas, números y un carácter especial.',
        },
      ]);
    }
  });

  it('sends a single request for simultaneous calls with the same token (D8 in-flight promise sharing)', async () => {
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/activate', async () => {
        callCount++;
        await delay(50);
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const [res1, res2, res3] = await Promise.all([
      activateAccount({ token: validToken, password: validPassword }),
      activateAccount({ token: validToken, password: validPassword }),
      activateAccount({ token: validToken, password: validPassword }),
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(mockSuccessResponse);
    expect(res2).toEqual(mockSuccessResponse);
    expect(res3).toEqual(mockSuccessResponse);
  });

  it('sends a new request after the previous one settled (D8 map cleanup on finally)', async () => {
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/activate', async () => {
        callCount++;
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const first = await activateAccount({ token: validToken, password: validPassword });
    expect(callCount).toBe(1);
    expect(first).toEqual(mockSuccessResponse);

    const second = await activateAccount({ token: validToken, password: validPassword });
    expect(callCount).toBe(2);
    expect(second).toEqual(mockSuccessResponse);
  });
});
