import type { Request, RequestHandler } from 'express';
import type { CatalogObjectivesRequest, CatalogVersionIdParams } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { ReorderCatalogItemsUseCase } from '../../application/reorder-catalog-items.js';
import type { SaveEducationalObjectiveUseCase } from '../../application/save-educational-objective.js';

export interface CatalogVersionItemsControllerDependencies {
  readonly saveEducationalObjectiveUseCase: SaveEducationalObjectiveUseCase;
  readonly reorderCatalogItemsUseCase: ReorderCatalogItemsUseCase;
}

function resolveActor(req: Request): { actorId: string; ip: string } {
  const context = getRequestContext();
  const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;
  if (!actorId) {
    throw new UnauthorizedError('No autenticado');
  }
  const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
  return { actorId, ip };
}

/** Controlador de la edición de OE y AG de una versión y de su detalle (HU-014). */
export class CatalogVersionItemsController {
  private readonly saveEducationalObjectiveUseCase: SaveEducationalObjectiveUseCase;
  private readonly reorderCatalogItemsUseCase: ReorderCatalogItemsUseCase;

  constructor(deps: CatalogVersionItemsControllerDependencies) {
    this.saveEducationalObjectiveUseCase = deps.saveEducationalObjectiveUseCase;
    this.reorderCatalogItemsUseCase = deps.reorderCatalogItemsUseCase;
  }

  editObjectives: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const { id: versionId } = req.params as CatalogVersionIdParams;
      const body = req.body as CatalogObjectivesRequest;

      const response =
        body.operation === 'SAVE'
          ? await this.saveEducationalObjectiveUseCase.execute({
              actorId,
              ip,
              versionId,
              id: body.id,
              code: body.code,
              statement: body.statement,
            })
          : await this.reorderCatalogItemsUseCase.execute({
              actorId,
              ip,
              versionId,
              kind: 'OBJECTIVES',
              orderedIds: body.orderedIds,
            });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
