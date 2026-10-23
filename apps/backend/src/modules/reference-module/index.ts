import type { Router } from 'express';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import type { ReferenceItemRepository } from './domain/ports/reference-item-repository.js';
import { InMemoryReferenceItemRepository } from './infrastructure/memory/in-memory-reference-item-repository.js';
import { CreateReferenceItemUseCase } from './application/create-reference-item.js';
import { ReferenceItemController } from './infrastructure/http/reference-item.controller.js';
import { createReferenceItemRouter } from './infrastructure/http/reference-item.routes.js';

export interface ReferenceModuleDependencies {
  unitOfWork: UnitOfWork;
  repository?: ReferenceItemRepository;
}

export function createReferenceModule(deps: ReferenceModuleDependencies): Router {
  const repository = deps.repository ?? new InMemoryReferenceItemRepository();
  const createUseCase = new CreateReferenceItemUseCase(repository, deps.unitOfWork);
  const controller = new ReferenceItemController(createUseCase);

  return createReferenceItemRouter(controller);
}

export * from './domain/entities/reference-item.js';
export * from './domain/ports/reference-item-repository.js';
export * from './domain/errors/reference-item-already-exists-error.js';
export * from './application/create-reference-item.js';
