import { randomUUID } from 'node:crypto';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { TemplateVersion } from '../domain/entities/template-version.js';
import { TemplateNotFoundError, TemplateVersionNotEditableError } from '../domain/errors/index.js';
import { validateTemplateContent } from '../domain/policies/template-content-policy.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateRepository } from '../domain/ports/template-repository.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import type { TemplateVersionRepository } from '../domain/ports/template-version-repository.js';
import type { EditTemplateCommand, EditTemplateResult } from './edit-template.types.js';
import { auditPayloadOf } from './template-audit.js';
import { toTemplateVersionDto } from './template-dto.js';

export interface EditTemplateDependencies {
  readonly templateRepository: TemplateRepository;
  readonly versionReader: TemplateVersionReader;
  readonly versionRepository: TemplateVersionRepository;
  readonly permissionChecker: TemplatePermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Edita una plantilla (HU-018, RF-018, RS-020): crea el Borrador o actualiza el existente. El
 * bloqueo de la plantilla serializa editar y publicar; el cambio y su auditoría se confirman en
 * una sola transacción. Contenido idéntico al Borrador no escribe ni audita (idempotente).
 */
export class EditTemplateUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: EditTemplateDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: EditTemplateCommand): Promise<EditTemplateResult> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'plantilla.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const template = await this.deps.templateRepository.lockForUpdate(command.templateId);
      if (!template) {
        throw new TemplateNotFoundError();
      }
      validateTemplateContent(
        command.content,
        template.variables.map((variable) => variable.key),
      );

      const now = this.clock();
      const draft = await this.deps.versionReader.findDraft(template.id);

      if (draft) {
        if (draft.content === command.content) {
          return { created: false, version: toTemplateVersionDto(draft) };
        }
        const updated = draft.withContent(command.content, command.actorId, now);
        const changed = await this.deps.versionRepository.updateDraftContent(
          draft.id,
          command.content,
          command.actorId,
          now,
        );
        if (!changed) {
          throw new TemplateVersionNotEditableError();
        }
        await this.deps.auditLogger.log({
          action: 'UPDATE',
          entity: 'TemplateVersion',
          entityId: draft.id,
          actor: command.actorId,
          ip: command.ip,
          before: auditPayloadOf(draft),
          after: auditPayloadOf(updated),
        });
        return { created: false, version: toTemplateVersionDto(updated) };
      }

      const number = (await this.deps.versionReader.maxNumber(template.id)) + 1;
      const created = TemplateVersion.createDraft({
        id: this.idGenerator(),
        templateId: template.id,
        number,
        content: command.content,
        actorId: command.actorId,
        now,
      });
      await this.deps.versionRepository.saveDraft(created);
      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'TemplateVersion',
        entityId: created.id,
        actor: command.actorId,
        ip: command.ip,
        before: null,
        after: auditPayloadOf(created),
      });
      return { created: true, version: toTemplateVersionDto(created) };
    });
  }
}
