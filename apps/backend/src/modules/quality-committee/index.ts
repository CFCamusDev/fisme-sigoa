import { Router } from 'express';

export function createQualityCommitteeModule(): Router {
  return Router();
}

export * from './domain/entities/committee-member-position.js';
export * from './domain/entities/committee-member.js';
export * from './domain/entities/quality-committee.js';
export * from './domain/policies/committee-composition.js';
export * from './domain/policies/committee-period.js';
export * from './domain/policies/president-alert.js';
export * from './domain/errors/index.js';
export * from './domain/ports/index.js';
export * from './application/committee-dto.js';
export * from './application/register-quality-committee.js';
export * from './application/register-quality-committee.types.js';
export * from './application/manage-committee-members.js';
export * from './application/manage-committee-members.types.js';
