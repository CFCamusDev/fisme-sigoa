import { randomUUID } from 'node:crypto';
import type { ResolutionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { validateFile } from '../../../shared/storage/file-validator.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { ResolutionPdf } from '../domain/entities/resolution.js';
import {
  InvalidResolutionTransitionError,
  ResolutionNotFoundError,
  ResolutionPdfRequiredError,
} from '../domain/errors/index.js';
import type { ResolutionEventPublisher } from '../domain/ports/resolution-event-publisher.js';
import type { ResolutionPdfStorage } from '../domain/ports/resolution-pdf-storage.js';
import type { ResolutionPermissionChecker } from '../domain/ports/resolution-permission-checker.js';
import type { ResolutionRepository } from '../domain/ports/resolution-repository.js';
import type { ApproveResolutionCommand } from './approve-resolution.types.js';
import { buildResolutionDto } from './resolution-dto.js';
import { RESOLUTION_PDF_MAX_BYTES, RESOLUTION_PDF_MIME_TYPE } from './resolution-pdf-rules.js';

export interface ApproveResolutionLogger {
  warn(meta: Record<string, unknown>, message: string): void;
}

export interface ApproveResolutionDependencies {
  readonly resolutionRepository: ResolutionRepository;
  readonly pdfStorage: ResolutionPdfStorage;
  readonly eventPublisher: ResolutionEventPublisher;
  readonly permissionChecker: ResolutionPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly logger?: ApproveResolutionLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Aprueba una resolución Registrada con su PDF firmado (HU-048, RF-048, RN-063, RS-020).
 *
 * El archivo se valida y se sube **antes** de abrir la transacción, para que la red no retenga el
 * bloqueo de fila (D4). Dentro de la transacción se bloquea la fila, se cambia el estado con una
 * actualización condicional, se publica `ResolutionApproved` a los suscriptores (misma
 * transacción, D5) y se audita. Si algo falla, se revierte todo y el archivo subido se descarta.
 * De N aprobaciones simultáneas solo una gana; el resto recibe 409 (política ⚠ del plan).
 */
export class ApproveResolutionUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: ApproveResolutionDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ApproveResolutionCommand): Promise<ResolutionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'resolucion.aprobar',
      scope: 'GLOBAL',
    });

    const file = command.file;
    if (!file || file.content.length === 0) {
      throw new ResolutionPdfRequiredError();
    }
    validateFile(file, {
      allowedMimeTypes: [RESOLUTION_PDF_MIME_TYPE],
      maxBytes: RESOLUTION_PDF_MAX_BYTES,
    });

    const uploaded = await this.deps.pdfStorage.upload({
      content: file.content,
      originalName: file.originalName,
    });

    try {
      return await this.deps.unitOfWork.run(async () => {
        const current = await this.deps.resolutionRepository.lockForApproval(command.resolutionId);
        if (!current) {
          throw new ResolutionNotFoundError();
        }

        const now = this.clock();
        const pdf: ResolutionPdf = { fileId: this.idGenerator(), ...uploaded };
        const { resolution, event } = current.approve({ pdf, actorId: command.actorId, now });

        const won = await this.deps.resolutionRepository.approve(
          current.id,
          pdf,
          command.actorId,
          now,
        );
        if (!won) {
          throw new InvalidResolutionTransitionError();
        }

        await this.deps.eventPublisher.publish(event);

        await this.deps.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'Resolution',
          entityId: current.id,
          actor: command.actorId,
          ip: command.ip,
          before: { status: current.status },
          after: {
            status: resolution.status,
            pdfSha256: uploaded.sha256,
            sizeBytes: uploaded.sizeBytes,
          },
        });

        return buildResolutionDto(resolution);
      });
    } catch (error) {
      await this.discardUploaded(uploaded.publicId);
      throw error;
    }
  }

  /** Compensación no bloqueante: un fallo al borrar se registra y no oculta el error original. */
  private async discardUploaded(publicId: string): Promise<void> {
    try {
      await this.deps.pdfStorage.discard(publicId);
    } catch (discardError) {
      this.deps.logger?.warn(
        {
          publicId,
          error: discardError instanceof Error ? discardError.message : String(discardError),
        },
        'No se pudo descartar el PDF subido de una aprobación no confirmada',
      );
    }
  }
}
