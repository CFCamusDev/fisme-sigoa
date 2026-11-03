import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequireAllowedOrigin } from './require-allowed-origin.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';

describe('require-allowed-origin middleware (HU-002, Tramo 4, D3)', () => {
  const allowedOrigins = ['http://localhost:5173', 'https://sigoa.untrm.edu.pe'];

  function setupApp(handler: express.RequestHandler) {
    const app = express();
    app.use(createRequireAllowedOrigin(allowedOrigins));
    app.post('/test-endpoint', handler);
    app.use(errorHandler);
    return app;
  }

  it('lets a request without Origin through', async () => {
    const mockHandler = vi.fn((_req, res) => res.status(200).json({ ok: true }));
    const app = setupApp(mockHandler);

    const response = await request(app).post('/test-endpoint');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('lets an allowed origin through', async () => {
    const mockHandler = vi.fn((_req, res) => res.status(200).json({ ok: true }));
    const app = setupApp(mockHandler);

    const response = await request(app)
      .post('/test-endpoint')
      .set('Origin', 'https://sigoa.untrm.edu.pe');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('responds 403 FORBIDDEN for another origin without calling the handler', async () => {
    const mockHandler = vi.fn((_req, res) => res.status(200).json({ ok: true }));
    const app = setupApp(mockHandler);

    const response = await request(app)
      .post('/test-endpoint')
      .set('Origin', 'https://malicious-site.attacker.com');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toContain('no autorizado');
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
