import type { RequestHandler } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateCatalogVersionUseCase } from '../../application/create-catalog-version.js';

export interface CatalogVersionsControllerDependencies {
  readonly createCatalogVersionUseCase: CreateCatalogVersionUseCase;
}

/** Controlador de `/catalog-versions` (HU-013). */
export class CatalogVersionsController {
  private readonly createCatalogVersionUseCase: CreateCatalogVersionUseCase;

  constructor(deps: CatalogVersionsControllerDependencies) {
    this.createCatalogVersionUseCase = deps.createCatalogVersionUseCase;
  }

  createCatalogVersion: RequestHandler = async (req, res, next) => {
    try {
      const context = getRequestContext();
      const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;

      if (!actorId) {
        throw new UnauthorizedError('No autenticado');
      }

      const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';

      const response = await this.createCatalogVersionUseCase.execute({ actorId, ip });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}
