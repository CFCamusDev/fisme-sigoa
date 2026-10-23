import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Env } from '../../config/env.js';
import { TooManyRequestsError } from '../errors/app-error.js';

export type RateLimitProfile = 'public' | 'login' | 'general';

export function createRateLimiter(profile: RateLimitProfile, env: Env): RateLimitRequestHandler {
  const maxLimit =
    profile === 'public'
      ? env.RATE_LIMIT_PUBLIC_MAX
      : profile === 'login'
        ? env.RATE_LIMIT_LOGIN_MAX
        : env.RATE_LIMIT_GENERAL_MAX;

  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: maxLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError());
    },
  });
}
