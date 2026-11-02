import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { resolveClientIp } from './client-ip.js';

describe('resolveClientIp', () => {
  it('ignores a spoofed x-forwarded-for when no proxy is trusted', async () => {
    let capturedIp = '';
    const app = express();
    app.set('trust proxy', false);

    app.get('/test-ip', (req, res) => {
      capturedIp = resolveClientIp(req);
      res.status(200).json({ ip: capturedIp });
    });

    await request(app).get('/test-ip').set('X-Forwarded-For', '203.0.113.195');

    // Sin proxy confiable, req.ip no debe tomar la cabecera falsificada
    expect(capturedIp).not.toBe('203.0.113.195');
  });

  it('uses the forwarded address when the proxy is trusted', async () => {
    let capturedIp = '';
    const app = express();
    app.set('trust proxy', 1);

    app.get('/test-ip', (req, res) => {
      capturedIp = resolveClientIp(req);
      res.status(200).json({ ip: capturedIp });
    });

    await request(app).get('/test-ip').set('X-Forwarded-For', '203.0.113.195');

    expect(capturedIp).toBe('203.0.113.195');
  });

  it('falls back to empty string when neither req.ip nor socket address are available', () => {
    const mockReq = {
      ip: undefined,
      socket: {},
    } as unknown as express.Request;

    expect(resolveClientIp(mockReq)).toBe('');
  });
});
