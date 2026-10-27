import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { healthResponseSchema } from '@sigoa/shared';
import { createApp } from './app.js';
import { createTestEnv } from './test/test-env.js';

describe('app', () => {
  const env = createTestEnv();

  it('GET /health responds 200 with ok status', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health body matches the shared health schema', async () => {
    const app = createApp({ env });
    const response = await request(app).get('/health');

    const parsed = healthResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });
});
