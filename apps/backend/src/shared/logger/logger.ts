import pino, { type Logger, type DestinationStream } from 'pino';
import type { Env } from '../../config/env.js';

export type { Logger };

export function createLogger(env: Env, customDestination?: DestinationStream): Logger {
  if (env.NODE_ENV === 'test' && !customDestination) {
    return pino({ level: 'silent' });
  }

  const isDev = env.NODE_ENV === 'development';

  if (isDev && !customDestination) {
    return pino({
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
    });
  }

  return pino(
    {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    customDestination,
  );
}
