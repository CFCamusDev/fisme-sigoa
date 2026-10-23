import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pinoHttp, type HttpLogger } from 'pino-http';
import type { Logger } from '../logger/logger.js';

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function createHttpLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const header = req.headers['x-request-id'];
      const existingId = Array.isArray(header) ? header[0] : header;
      const requestId =
        existingId && SAFE_REQUEST_ID_REGEX.test(existingId) ? existingId : randomUUID();

      res.setHeader('x-request-id', requestId);
      return requestId;
    },
    customProps: (req: IncomingMessage) => ({
      requestId: (req as IncomingMessage & { id?: string }).id,
    }),
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
}
