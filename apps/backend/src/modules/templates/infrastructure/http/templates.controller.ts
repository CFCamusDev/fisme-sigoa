import type { Request, RequestHandler } from 'express';
import type {
  ListTemplatesQuery,
  PreviewTemplateRequest,
  PublishTemplateRequest,
  SaveTemplateDraftRequest,
  TemplateIdParams,
} from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { EditTemplateUseCase } from '../../application/edit-template.js';
import type { GetTemplateDetailUseCase } from '../../application/get-template-detail.js';
import type { ListTemplatesUseCase } from '../../application/list-templates.js';
import type { PreviewTemplateUseCase } from '../../application/preview-template.js';
import type { PublishTemplateUseCase } from '../../application/publish-template.js';

export interface TemplatesControllerDependencies {
  readonly listTemplatesUseCase: ListTemplatesUseCase;
  readonly getTemplateDetailUseCase: GetTemplateDetailUseCase;
  readonly editTemplateUseCase: EditTemplateUseCase;
  readonly publishTemplateUseCase: PublishTemplateUseCase;
  readonly previewTemplateUseCase: PreviewTemplateUseCase;
}

function resolveActorId(req: Request): string {
  const context = getRequestContext();
  const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;
  if (!actorId) {
    throw new UnauthorizedError('No autenticado');
  }
  return actorId;
}

function resolveIp(req: Request): string {
  return getRequestContext()?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
}

/** Controlador de `/templates` (HU-018). */
export class TemplatesController {
  private readonly listTemplatesUseCase: ListTemplatesUseCase;
  private readonly getTemplateDetailUseCase: GetTemplateDetailUseCase;
  private readonly editTemplateUseCase: EditTemplateUseCase;
  private readonly publishTemplateUseCase: PublishTemplateUseCase;
  private readonly previewTemplateUseCase: PreviewTemplateUseCase;

  constructor(deps: TemplatesControllerDependencies) {
    this.listTemplatesUseCase = deps.listTemplatesUseCase;
    this.getTemplateDetailUseCase = deps.getTemplateDetailUseCase;
    this.editTemplateUseCase = deps.editTemplateUseCase;
    this.publishTemplateUseCase = deps.publishTemplateUseCase;
    this.previewTemplateUseCase = deps.previewTemplateUseCase;
  }

  /** `201` si se creó el Borrador; `200` si se actualizó o no cambió (idempotente, D1). */
  saveDraft: RequestHandler = async (req, res, next) => {
    try {
      const actorId = resolveActorId(req);
      const { id: templateId } = req.params as TemplateIdParams;
      const body = req.body as SaveTemplateDraftRequest;

      const result = await this.editTemplateUseCase.execute({
        actorId,
        ip: resolveIp(req),
        templateId,
        content: body.content,
      });

      res
        .setHeader('Cache-Control', 'no-store')
        .status(result.created ? 201 : 200)
        .json(result.version);
    } catch (error) {
      next(error);
    }
  };

  publishTemplate: RequestHandler = async (req, res, next) => {
    try {
      const actorId = resolveActorId(req);
      const { id: templateId } = req.params as TemplateIdParams;
      const body = req.body as PublishTemplateRequest;

      const response = await this.publishTemplateUseCase.execute({
        actorId,
        ip: resolveIp(req),
        templateId,
        versionId: body.versionId,
        expectedUpdatedAt: body.expectedUpdatedAt,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

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

  previewTemplate: RequestHandler = async (req, res, next) => {
    try {
      const actorId = resolveActorId(req);
      const { id: templateId } = req.params as TemplateIdParams;
      const body = req.body as PreviewTemplateRequest;

      const response = await this.previewTemplateUseCase.execute({
        actorId,
        templateId,
        content: body.content,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
