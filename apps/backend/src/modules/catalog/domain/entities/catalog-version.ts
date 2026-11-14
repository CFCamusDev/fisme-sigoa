import { InvalidCatalogDataError } from '../errors/invalid-catalog-data-error.js';
import { assertTransition } from '../policies/catalog-version-state-machine.js';

import { CATALOG_VERSION_STATUSES, type CatalogVersionStatus } from './catalog-version-status.js';

export { CATALOG_VERSION_STATUSES, type CatalogVersionStatus };

export interface CatalogVersionProperties {
  readonly id: string;
  readonly programId: string;
  readonly number: number;
  status: CatalogVersionStatus;
  readonly basedOnVersionId: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDraftInput {
  id: string;
  programId: string;
  number: number;
  basedOnVersionId?: string | null;
  actorId?: string;
  now?: Date;
}

/** Alias de tipo (no interfaz) para que sirva como carga de auditoría. */
export type CatalogVersionSnapshot = {
  readonly programId: string;
  readonly number: number;
  readonly status: CatalogVersionStatus;
  readonly basedOnVersionId: string | null;
};

export interface SendToValidationInput {
  objectiveCount: number;
  attributeCount: number;
  actorId: string;
  now?: Date;
}

export interface LifecycleInput {
  actorId: string;
  now?: Date;
}

export class CatalogVersion {
  private constructor(private readonly props: CatalogVersionProperties) {}

  /** Reconstruye una versión ya persistida. */
  public static create(rawProps: CatalogVersionProperties): CatalogVersion {
    if (!Number.isInteger(rawProps.number) || rawProps.number < 1) {
      throw new InvalidCatalogDataError(
        'El número de versión debe ser un entero mayor o igual a 1.',
      );
    }
    if (!CATALOG_VERSION_STATUSES.includes(rawProps.status)) {
      throw new InvalidCatalogDataError('El estado de la versión del catálogo no es válido.');
    }
    return new CatalogVersion({ ...rawProps, basedOnVersionId: rawProps.basedOnVersionId ?? null });
  }

  /** Una versión nueva siempre nace en Borrador. */
  public static createDraft(input: CreateDraftInput): CatalogVersion {
    const now = input.now ?? new Date();
    return CatalogVersion.create({
      id: input.id,
      programId: input.programId,
      number: input.number,
      status: 'DRAFT',
      basedOnVersionId: input.basedOnVersionId ?? null,
      createdBy: input.actorId ?? null,
      updatedBy: input.actorId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get programId(): string {
    return this.props.programId;
  }

  public get number(): number {
    return this.props.number;
  }

  public get status(): CatalogVersionStatus {
    return this.props.status;
  }

  public get basedOnVersionId(): string | null {
    return this.props.basedOnVersionId;
  }

  public get createdBy(): string | null | undefined {
    return this.props.createdBy;
  }

  public get updatedBy(): string | null | undefined {
    return this.props.updatedBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Abierta = Borrador o En validación; solo puede haber una por programa (RF-013). */
  public isOpen(): boolean {
    return this.props.status === 'DRAFT' || this.props.status === 'IN_VALIDATION';
  }

  /**
   * Borrador → En validación (RF-015, RS-020): exige al menos 1 OE y 1 AG. Devuelve una versión
   * nueva; la actual no cambia. Lanza `InvalidCatalogTransitionError` si no se cumple.
   */
  public sendToValidation(input: SendToValidationInput): CatalogVersion {
    assertTransition({
      from: this.props.status,
      to: 'IN_VALIDATION',
      objectiveCount: input.objectiveCount,
      attributeCount: input.attributeCount,
      approvedResolution: false,
    });
    return CatalogVersion.create({
      ...this.props,
      status: 'IN_VALIDATION',
      updatedBy: input.actorId,
      updatedAt: input.now ?? new Date(),
    });
  }

  /**
   * En validación → Aprobada (vigente) al aprobarse su resolución (RF-016). Devuelve una versión
   * nueva; lanza `InvalidCatalogTransitionError` si el estado no lo permite.
   */
  public activate(input: LifecycleInput): CatalogVersion {
    assertTransition({
      from: this.props.status,
      to: 'APPROVED',
      objectiveCount: 0,
      attributeCount: 0,
      approvedResolution: true,
    });
    return CatalogVersion.create({
      ...this.props,
      status: 'APPROVED',
      updatedBy: input.actorId,
      updatedAt: input.now ?? new Date(),
    });
  }

  /** Aprobada → Histórica cuando otra versión pasa a ser la vigente (RF-016). */
  public supersede(input: LifecycleInput): CatalogVersion {
    assertTransition({
      from: this.props.status,
      to: 'HISTORICAL',
      objectiveCount: 0,
      attributeCount: 0,
      approvedResolution: false,
    });
    return CatalogVersion.create({
      ...this.props,
      status: 'HISTORICAL',
      updatedBy: input.actorId,
      updatedAt: input.now ?? new Date(),
    });
  }

  public snapshot(): CatalogVersionSnapshot {
    return {
      programId: this.props.programId,
      number: this.props.number,
      status: this.props.status,
      basedOnVersionId: this.props.basedOnVersionId,
    };
  }
}
