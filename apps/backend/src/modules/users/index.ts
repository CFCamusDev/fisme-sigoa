import { Router } from 'express';

export function createUsersModule(): Router {
  const router = Router();
  return router;
}

export * from './infrastructure/email/email-activation-sender.js';
