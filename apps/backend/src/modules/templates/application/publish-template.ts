import type { TemplateVersionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  InvalidTemplateTransitionError,
  TemplateDraftChangedError,
  TemplateNotFoundError,
  TemplateVersionNotFoundError,
} from '../domain/errors/index.js';
import { validateTemplateContent } from '../domain/policies/template-content-policy.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateRepository } from '../domain/ports/template-repository.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import type { TemplateVersionRepository } from '../domain/ports/template-version-repository.js';
import type { PublishTemplateCommand } from './publish-template.types.js';
import { auditPayloadOf } from './template-audit.js';
import { toTemplateVersionDto } from './template-dto.js';

export interface PublishTemplateDependencies {
  readonly templateRepository: TemplateRepository;
  readonly versionReader: TemplateVersionReader;
  readonly versionRepository: TemplateVersionRepository;
  readonly permissionChecker: TemplatePermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Publica el Borrador de una plantilla (HU-018, RF-018, RN-004, RS-020, RS-024). Deja Obsoleta la
 * Publicada anterior y publica la nueva en una sola transacción, con su auditoría. Un Borrador es
 * un recurso de un solo uso: publicarlo otra vez, o publicar uno que cambió, responde 409 sin
 * cambios ni auditoría. Nunca reescribe el contenido de la versión anterior (RN-007).
 */
export class PublishTemplateUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: PublishTemplateDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: PublishTemplateCommand): Promise<TemplateVersionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'plantilla.publicar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const template = await this.deps.templateRepository.lockForUpdate(command.templateId);
      if (!template) {
        throw new TemplateNotFoundError();
      }

      const draft = await this.deps.versionReader.findById(command.versionId);
      if (!draft || draft.templateId !== template.id) {
        throw new TemplateVersionNotFoundError();
      }
      if (draft.status !== 'DRAFT') {
        throw new InvalidTemplateTransitionError();
      }
      if (draft.updatedAt.toISOString() !== new Date(command.expectedUpdatedAt).toISOString()) {
        throw new TemplateDraftChangedError();
      }
      validateTemplateContent(
        draft.content,
        template.variables.map((variable) => variable.key),
      );

      const now = this.clock();

      // El índice único de Publicada exige dejar Obsoleta la anterior antes de publicar la nueva.
      const previous = await this.deps.versionReader.findPublished(template.id);
      if (previous) {
        const obsolete = previous.markObsolete({ actorId: command.actorId, now });
        const moved = await this.deps.versionRepository.transitionStatus(
          previous.id,
          'PUBLISHED',
          'OBSOLETE',
          command.actorId,
          now,
        );
        if (!moved) {
          throw new InvalidTemplateTransitionError();
        }
        await this.deps.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'TemplateVersion',
          entityId: previous.id,
          actor: command.actorId,
          ip: command.ip,
          before: auditPayloadOf(previous),
          after: auditPayloadOf(obsolete),
        });
      }

      const published = draft.publish({ actorId: command.actorId, now });
      const moved = await this.deps.versionRepository.transitionStatus(
        draft.id,
        'DRAFT',
        'PUBLISHED',
        command.actorId,
        now,
      );
      if (!moved) {
        throw new InvalidTemplateTransitionError();
      }
      await this.deps.auditLogger.log({
        action: 'STATE_CHANGE',
        entity: 'TemplateVersion',
        entityId: draft.id,
        actor: command.actorId,
        ip: command.ip,
        before: auditPayloadOf(draft),
        after: auditPayloadOf(published),
      });

      return toTemplateVersionDto(published);
    });
  }
}
