import type { Request, RequestHandler } from 'express';
import { ANNEX_PDF_CONTENT_TYPE, type AnnexCodeParams } from '@sigoa/shared';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { GenerateAnnexPdfUseCase } from '../../application/generate-annex-pdf.js';

export interface AnnexesControllerDependencies {
  readonly generateAnnexPdfUseCase: GenerateAnnexPdfUseCase;
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

/** Controlador de `/annexes` (HU-070). */
export class AnnexesController {
  private readonly generateAnnexPdfUseCase: GenerateAnnexPdfUseCase;

  constructor(deps: AnnexesControllerDependencies) {
    this.generateAnnexPdfUseCase = deps.generateAnnexPdfUseCase;
  }

  downloadPdf: RequestHandler = async (req, res, next) => {
    try {
      const actorId = resolveActorId(req);
      const { code } = getValidated<unknown, AnnexCodeParams>(res).params;

      const result = await this.generateAnnexPdfUseCase.execute({
        actorId,
        ip: resolveIp(req),
        annexCode: code,
      });

      res
        .setHeader('Content-Type', ANNEX_PDF_CONTENT_TYPE)
        .setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
        .setHeader('Cache-Control', 'no-store')
        .setHeader('X-Template-Version', String(result.versionNumber))
        .status(200)
        .send(result.pdf);
    } catch (error) {
      next(error);
    }
  };
}
