import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AccessDenial, AccessDenialRecorder } from '../domain/ports/access-denial-recorder.js';

export interface AccessDenialErrorLogger {
  error(payload: Record<string, unknown>, message: string): void;
}

export interface AuditAccessDenialRecorderDependencies {
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly logger?: AccessDenialErrorLogger;
}

const MAX_PERMISSION_ENTITY_ID_LENGTH = 100;

export class AuditAccessDenialRecorder implements AccessDenialRecorder {
  public constructor(private readonly deps: AuditAccessDenialRecorderDependencies) {}

  public async record(denial: AccessDenial): Promise<void> {
    const entityId = denial.permission.slice(0, MAX_PERMISSION_ENTITY_ID_LENGTH);
    const after: Record<string, unknown> = {
      reason: denial.reason,
      requiredScope: denial.requiredScope,
      grantedScope: denial.grantedScope,
      method: denial.method ?? 'USE_CASE',
      route: denial.route ?? 'USE_CASE',
      ...(denial.resourceType !== undefined ? { resourceType: denial.resourceType } : {}),
      ...(denial.resourceId !== undefined ? { resourceId: denial.resourceId } : {}),
    };

    try {
      await this.deps.unitOfWork.run(async () => {
        await this.deps.auditLogger.log({
          action: 'ACCESS_DENIED',
          actor: denial.actorId,
          entity: 'Permission',
          entityId,
          after,
        });
      });
    } catch (error) {
      // D4: responder igualmente 403 y registrar el error sin datos personales
      this.deps.logger?.error(
        {
          err: error instanceof Error ? error.message : 'Unknown audit failure',
          permission: entityId,
          reason: denial.reason,
        },
        'Failed to record ACCESS_DENIED audit event',
      );
    }
  }
}
