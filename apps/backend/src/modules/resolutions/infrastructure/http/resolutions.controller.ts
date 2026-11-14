import type { Request, RequestHandler } from 'express';
import type {
  ListResolutionsQuery,
  RegisterResolutionRequest,
  ResolutionIdParams,
} from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { ApproveResolutionUseCase } from '../../application/approve-resolution.js';
import type { ListResolutionsUseCase } from '../../application/list-resolutions.js';
import type { RegisterResolutionUseCase } from '../../application/register-resolution.js';

export interface ResolutionsControllerDependencies {
  readonly registerResolutionUseCase: RegisterResolutionUseCase;
  readonly approveResolutionUseCase: ApproveResolutionUseCase;
  readonly listResolutionsUseCase: ListResolutionsUseCase;
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

/** Controlador de `/resolutions` (HU-048). */
export class ResolutionsController {
  private readonly registerResolutionUseCase: RegisterResolutionUseCase;
  private readonly approveResolutionUseCase: ApproveResolutionUseCase;
  private readonly listResolutionsUseCase: ListResolutionsUseCase;

  constructor(deps: ResolutionsControllerDependencies) {
    this.registerResolutionUseCase = deps.registerResolutionUseCase;
    this.approveResolutionUseCase = deps.approveResolutionUseCase;
    this.listResolutionsUseCase = deps.listResolutionsUseCase;
  }

  registerResolution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const body = req.body as RegisterResolutionRequest;

      const response = await this.registerResolutionUseCase.execute({
        actorId,
        ip,
        type: body.type,
        number: body.number,
        issuedOn: body.issuedOn,
        catalogVersionId: body.catalogVersionId,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  approveResolution: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveActor(req);
      const { id: resolutionId } = req.params as ResolutionIdParams;
      // Sin cuerpo o con otro `Content-Type`, `express.raw` no produce un Buffer (CA3, D4).
      const content: unknown = req.body;
      const mimeType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';

      const response = await this.approveResolutionUseCase.execute({
        actorId,
        ip,
        resolutionId,
        file: Buffer.isBuffer(content)
          ? { content, originalName: `resolution-${resolutionId}.pdf`, mimeType }
          : null,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  listResolutions: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveActor(req);
      const query = req.query as unknown as ListResolutionsQuery;

      const response = await this.listResolutionsUseCase.execute({
        actorId,
        type: query.type,
        status: query.status,
        catalogVersionId: query.catalogVersionId,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
