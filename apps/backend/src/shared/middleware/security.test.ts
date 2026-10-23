import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestEnv } from '../../test/test-env.js';

describe('security middleware (Helmet, CORS, HSTS)', () => {
  const env = createTestEnv({
    CORS_ORIGIN: ['http://localhost:5173', 'https://sigoa.untrm.edu.pe'],
    HSTS_ENABLED: true,
  });

  it('sets security headers on every response', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('does not expose x-powered-by', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sends strict-transport-security when HSTS is enabled', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health');

    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
  });

  it('omits strict-transport-security when HSTS is disabled', async () => {
    const disabledEnv = createTestEnv({ HSTS_ENABLED: false });
    const app = createApp({ env: disabledEnv });
    const response = await request(app).get('/health');

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('allows a configured origin in CORS', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health').set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow an unlisted origin in CORS', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health').set('Origin', 'https://malicious-site.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight requests for a configured origin', async () => {
    const app = createApp({ env });
    const response = await request(app)
      .options('/health')
      .set('Origin', 'https://sigoa.untrm.edu.pe')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://sigoa.untrm.edu.pe');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('sets security headers on 404 and error responses', async () => {
    const app = createApp({ env });
    const response404 = await request(app).get('/non-existent-route');

    expect(response404.status).toBe(404);
    expect(response404.headers['x-content-type-options']).toBe('nosniff');
    expect(response404.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response404.headers['x-powered-by']).toBeUndefined();
  });
});
