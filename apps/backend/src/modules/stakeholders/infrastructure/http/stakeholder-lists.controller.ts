import type { RequestHandler } from 'express';
import {
  ANNEX_PDF_CONTENT_TYPE,
  STAKEHOLDER_IMPORT_XLSX_MIME,
  type AddStakeholderListMemberRequest,
  type CopyStakeholderListRequest,
  type CreateStakeholderListRequest,
  type ExportStakeholderListPdfParams,
  type ListStakeholderListsQuery,
  type StakeholderImportTemplateQuery,
  type StakeholderListIdParams,
} from '@sigoa/shared';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { AddStakeholderListMemberUseCase } from '../../application/add-stakeholder-list-member.js';
import type { ConfirmStakeholderImportUseCase } from '../../application/confirm-stakeholder-import.js';
import type { CopyStakeholderListToNewYearUseCase } from '../../application/copy-stakeholder-list-to-new-year.js';
import type { CreateStakeholderListUseCase } from '../../application/create-stakeholder-list.js';
import type { DownloadStakeholderImportTemplateUseCase } from '../../application/download-stakeholder-import-template.js';
import type { ExportStakeholderListPdfUseCase } from '../../application/export-stakeholder-list-pdf.js';
import type { ListStakeholderListsUseCase } from '../../application/list-stakeholder-lists.js';
import type { PreviewStakeholderImportUseCase } from '../../application/preview-stakeholder-import.js';
import { resolveRequestActor } from '../../../../shared/middleware/resolve-request-actor.js';

export interface StakeholderListsControllerDependencies {
  readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
  readonly addStakeholderListMemberUseCase: AddStakeholderListMemberUseCase;
  readonly copyStakeholderListToNewYearUseCase: CopyStakeholderListToNewYearUseCase;
  readonly listStakeholderListsUseCase: ListStakeholderListsUseCase;
  readonly previewStakeholderImportUseCase: PreviewStakeholderImportUseCase;
  readonly confirmStakeholderImportUseCase: ConfirmStakeholderImportUseCase;
  readonly downloadStakeholderImportTemplateUseCase: DownloadStakeholderImportTemplateUseCase;
  readonly exportStakeholderListPdfUseCase?: ExportStakeholderListPdfUseCase;
}

/** Controlador de `/stakeholder-lists` (HU-022, HU-023, HU-026). */
export class StakeholderListsController {
  private readonly createStakeholderListUseCase: CreateStakeholderListUseCase;
  private readonly addStakeholderListMemberUseCase: AddStakeholderListMemberUseCase;
  private readonly copyStakeholderListToNewYearUseCase: CopyStakeholderListToNewYearUseCase;
  private readonly listStakeholderListsUseCase: ListStakeholderListsUseCase;
  private readonly previewStakeholderImportUseCase: PreviewStakeholderImportUseCase;
  private readonly confirmStakeholderImportUseCase: ConfirmStakeholderImportUseCase;
  private readonly downloadStakeholderImportTemplateUseCase: DownloadStakeholderImportTemplateUseCase;
  private readonly exportStakeholderListPdfUseCase?: ExportStakeholderListPdfUseCase;

  constructor(deps: StakeholderListsControllerDependencies) {
    this.createStakeholderListUseCase = deps.createStakeholderListUseCase;
    this.addStakeholderListMemberUseCase = deps.addStakeholderListMemberUseCase;
    this.copyStakeholderListToNewYearUseCase = deps.copyStakeholderListToNewYearUseCase;
    this.listStakeholderListsUseCase = deps.listStakeholderListsUseCase;
    this.previewStakeholderImportUseCase = deps.previewStakeholderImportUseCase;
    this.confirmStakeholderImportUseCase = deps.confirmStakeholderImportUseCase;
    this.downloadStakeholderImportTemplateUseCase = deps.downloadStakeholderImportTemplateUseCase;
    this.exportStakeholderListPdfUseCase = deps.exportStakeholderListPdfUseCase;
  }

  createStakeholderList: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const body = req.body as CreateStakeholderListRequest;

      const response = await this.createStakeholderListUseCase.execute({
        ...body,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  addStakeholderListMember: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = req.params as StakeholderListIdParams;
      const body = req.body as AddStakeholderListMemberRequest;

      const response = await this.addStakeholderListMemberUseCase.execute({
        ...body,
        listId: id,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  copyStakeholderList: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = req.params as StakeholderListIdParams;
      const body = req.body as CopyStakeholderListRequest;

      const response = await this.copyStakeholderListToNewYearUseCase.execute({
        sourceListId: id,
        year: body.year,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  listStakeholderLists: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const query = getValidated<unknown, unknown, ListStakeholderListsQuery>(res).query;

      const response = await this.listStakeholderListsUseCase.execute({
        actorId,
        type: query.type,
        year: query.year,
        includeMembers: query.includeMembers,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  previewStakeholderImport: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const { id } = req.params as StakeholderListIdParams;
      const fileBuffer = req.body as Buffer;

      const response = await this.previewStakeholderImportUseCase.execute({
        listId: id,
        fileBuffer,
        actorId,
      });

      res.setHeader('Cache-Control', 'no-store').status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  confirmStakeholderImport: RequestHandler = async (req, res, next) => {
    try {
      const { actorId, ip } = resolveRequestActor(req);
      const { id } = req.params as StakeholderListIdParams;
      const fileBuffer = req.body as Buffer;

      const response = await this.confirmStakeholderImportUseCase.execute({
        listId: id,
        fileBuffer,
        actorId,
        ip,
      });

      res.setHeader('Cache-Control', 'no-store').status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  downloadStakeholderImportTemplate: RequestHandler = async (req, res, next) => {
    try {
      const { actorId } = resolveRequestActor(req);
      const query = getValidated<unknown, unknown, StakeholderImportTemplateQuery>(res).query;

      const { fileName, buffer } = await this.downloadStakeholderImportTemplateUseCase.execute({
        type: query.type,
        actorId,
      });

      res
        .setHeader('Cache-Control', 'no-store')
        .setHeader('Content-Type', STAKEHOLDER_IMPORT_XLSX_MIME)
        .setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
        .status(200)
        .send(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportStakeholderListPdf: RequestHandler = async (req, res, next) => {
    try {
      if (!this.exportStakeholderListPdfUseCase) {
        res.status(404).end();
        return;
      }

      const { actorId, ip } = resolveRequestActor(req);
      const { id } = getValidated<unknown, ExportStakeholderListPdfParams>(res).params;

      const result = await this.exportStakeholderListPdfUseCase.execute({
        actorId,
        ip,
        listId: id,
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
