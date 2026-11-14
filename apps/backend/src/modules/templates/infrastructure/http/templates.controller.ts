import type { Request, RequestHandler } from 'express';
import type { ListTemplatesQuery, TemplateIdParams } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { GetTemplateDetailUseCase } from '../../application/get-template-detail.js';
import type { ListTemplatesUseCase } from '../../application/list-templates.js';

export interface TemplatesControllerDependencies {
  readonly listTemplatesUseCase: ListTemplatesUseCase;
  readonly getTemplateDetailUseCase: GetTemplateDetailUseCase;
}

function resolveActorId(req: Request): string {
  const context = getRequestContext();
  const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;
  if (!actorId) {
    throw new UnauthorizedError('No autenticado');
  }
  return actorId;
}

/** Controlador de `/templates` (HU-018). */
export class TemplatesController {
  private readonly listTemplatesUseCase: ListTemplatesUseCase;
  private readonly getTemplateDetailUseCase: GetTemplateDetailUseCase;

  constructor(deps: TemplatesControllerDependencies) {
    this.listTemplatesUseCase = deps.listTemplatesUseCase;
    this.getTemplateDetailUseCase = deps.getTemplateDetailUseCase;
  }

  listTemplates: RequestHandler = async (req, res, next) => {
    try {
      const actorId = resolveActorId(req);
      // `validateRequest` deja la consulta ya parseada (números y valores por defecto) en `res.locals`.
      const query = getValidated<unknown, unknown, ListTemplatesQuery>(res).query;

      const response = await this.listTemplatesUseCase.execute({
        actorId,
        type: query.type,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTemplate: RequestHandler = async (req, res, next) => {
    try {
      const actorId = resolveActorId(req);
      const { id: templateId } = req.params as TemplateIdParams;

      const response = await this.getTemplateDetailUseCase.execute({ actorId, templateId });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
