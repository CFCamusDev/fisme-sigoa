import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getRequestContext } from '../audit/request-context.js';
import { requestContextMiddleware } from './request-context.js';

describe('requestContextMiddleware (RS-041)', () => {
  const createTestApp = () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get('/test-context', (req, res) => {
      const context = getRequestContext();
      res.status(200).json({
        ip: context?.ip,
        requestId: context?.requestId,
      });
    });
    return app;
  };

  it('generates a valid UUID for X-Request-Id if none is provided', async () => {
    const app = createTestApp();
    const response = await request(app).get('/test-context');

    expect(response.status).toBe(200);
    const headerId = response.headers['x-request-id'];
    expect(headerId).toBeDefined();
    expect(headerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.body.requestId).toBe(headerId);
  });

  it('preserves and echoes back a valid incoming X-Request-Id', async () => {
    const app = createTestApp();
    const customId = 'custom-request-id-12345';
    const response = await request(app).get('/test-context').set('X-Request-Id', customId);

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(customId);
    expect(response.body.requestId).toBe(customId);
  });

  it('sanitizes and replaces an invalid or malicious incoming X-Request-Id', async () => {
    const app = createTestApp();
    const maliciousId = 'malicious<script>alert(1)</script>';
    const response = await request(app).get('/test-context').set('X-Request-Id', maliciousId);

    expect(response.status).toBe(200);
    const headerId = response.headers['x-request-id'];
    expect(headerId).not.toBe(maliciousId);
    expect(headerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('captures client IP correctly in the audit context', async () => {
    const app = createTestApp();
    const response = await request(app).get('/test-context');

    expect(response.status).toBe(200);
    expect(response.body.ip).toBeDefined();
  });
});
