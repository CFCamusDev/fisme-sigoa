import { ReferenceItem } from '../domain/entities/reference-item.js';
import type { ReferenceItemRepository } from '../domain/ports/reference-item-repository.js';
import { ReferenceItemAlreadyExistsError } from '../domain/errors/reference-item-already-exists-error.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';

export interface CreateReferenceItemCommand {
  code: string;
  title: string;
}

export interface ReferenceItemDto {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: string;
}

/**
 * Caso de uso de referencia — Molde obligatorio (AGENTS.md §4.2):
 * 1. Verificación de permiso y alcance (en HU reales se inyecta AuthorizationService/permission check).
 * 2. Carga de entidades y reglas del dominio.
 * 3. Parámetros vigentes con ParameterResolver (en HU reales cuando apliquen umbrales/parámetros).
 * 4. Persistencia y auditoría transaccional con UnitOfWork y AuditLogger (HU-075).
 * 5. Inmutabilidad de registros cerrados/aprobados (RN-007, RS-003).
 * 6. Retorno de DTO tipado, nunca entidades de persistencia.
 */
export class CreateReferenceItemUseCase {
  constructor(
    private readonly repository: ReferenceItemRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
  ) {}

  async execute(command: CreateReferenceItemCommand): Promise<ReferenceItemDto> {
    // 1. [Molde §4.2] Verificación de permiso y alcance (ej: requirePermission('reference.create', Scope.GLOBAL))

    // 2 y 4. [Molde §4.2] Ejecución dentro de la unidad de trabajo transaccional
    return await this.unitOfWork.run(async () => {
      // 3. [Molde §4.2] Lectura de parámetros vigentes (ParameterResolver) si aplica

      // Verificación de unicidad en el repositorio
      const existing = await this.repository.findByCode(command.code);
      if (existing) {
        throw new ReferenceItemAlreadyExistsError(command.code);
      }

      // Creación de la entidad aplicando invariantes de dominio
      const item = ReferenceItem.create({
        code: command.code,
        title: command.title,
      });

      // Persistencia
      await this.repository.save(item);

      const dto = item.toDto();

      // [Molde §4.2] Registro en la misma transacción con AuditLogger (HU-075, RS-041, RS-043)
      await this.auditLogger.log({
        action: 'CREATE',
        entity: 'ReferenceItem',
        entityId: item.id,
        after: { ...dto },
      });

      // 6. Retorno del DTO
      return dto;
    });
  }
}
