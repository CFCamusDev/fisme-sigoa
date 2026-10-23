import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Writable } from 'node:stream';
import { createApp } from '../../app.js';
import { createLogger } from '../logger/logger.js';
import { createTestEnv } from '../../test/test-env.js';

describe('http-logger middleware', () => {
  const baseEnv = createTestEnv({ LOG_LEVEL: 'info' });

  function createCaptureStream() {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    return { stream, logs };
  }

  it('logs each request with request id and response time', async () => {
    const { stream, logs } = createCaptureStream();
    const logger = createLogger(baseEnv, stream);
    const app = createApp({ logger, env: baseEnv });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    const logOutput = logs.join('\n');
    expect(logOutput).toContain('requestId');
    expect(logOutput).toContain('responseTime');
  });

  it('reuses a valid incoming x-request-id', async () => {
    const customId = 'client-req-12345';
    const app = createApp({ env: baseEnv });

    const response = await request(app).get('/health').set('x-request-id', customId);

    expect(response.headers['x-request-id']).toBe(customId);
  });

  it('replaces an invalid incoming x-request-id', async () => {
    const invalidId = 'invalid id with spaces & dangerous <chars>';
    const app = createApp({ env: baseEnv });

    const response = await request(app).get('/health').set('x-request-id', invalidId);

    expect(response.headers['x-request-id']).not.toBe(invalidId);
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('redacts the authorization header', async () => {
    const { stream, logs } = createCaptureStream();
    const logger = createLogger(baseEnv, stream);
    const app = createApp({ logger, env: baseEnv });

    const secretToken = 'Bearer sensitive-token-99999';
    await request(app).get('/health').set('authorization', secretToken);

    const logOutput = logs.join('\n');
    expect(logOutput).not.toContain('sensitive-token-99999');
  });

  it('returns x-request-id in the response', async () => {
    const app = createApp({ env: baseEnv });
    const response = await request(app).get('/health');

    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
  });
});
