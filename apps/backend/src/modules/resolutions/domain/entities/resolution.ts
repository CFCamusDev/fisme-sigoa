import { InvalidResolutionDataError } from '../errors/invalid-resolution-data-error.js';
import { ResolutionTypeNotAvailableError } from '../errors/resolution-type-not-available-error.js';
import { assertTransition } from '../policies/resolution-state-machine.js';
import type { ResolutionApproved } from './resolution-approved.js';
import {
  REGISTERABLE_RESOLUTION_TYPES,
  RESOLUTION_NUMBER_MAX_LENGTH,
  RESOLUTION_NUMBER_PATTERN,
  RESOLUTION_STATUSES,
  RESOLUTION_TYPES,
  type ResolutionStatus,
  type ResolutionType,
} from './resolution-enums.js';

export interface ResolutionProperties {
  readonly id: string;
  readonly type: ResolutionType;
  readonly number: string;
  readonly issuedOn: Date;
  readonly status: ResolutionStatus;
  readonly catalogVersionId: string | null;
  readonly pdfFileId: string | null;
  readonly approvedAt: Date | null;
  readonly approvedBy: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RegisterResolutionInput {
  id: string;
  type: ResolutionType;
  number: string;
  issuedOn: Date;
  catalogVersionId: string | null;
  actorId: string;
  now?: Date;
}

/** Datos del PDF firmado ya validado y subido; `fileId` es el id del `StoredFile` a crear. */
export interface ResolutionPdf {
  readonly fileId: string;
  readonly provider: string;
  readonly publicId: string;
  readonly url: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ApproveResolutionInput {
  pdf: ResolutionPdf | null;
  actorId: string;
  now?: Date;
}

/** Alias de tipo (no interfaz) para que sirva como carga de auditoría. */
export type ResolutionSnapshot = {
  readonly type: ResolutionType;
  readonly number: string;
  readonly issuedOn: string;
  readonly status: ResolutionStatus;
  readonly catalogVersionId: string | null;
};

export interface ApprovedResolution {
  readonly resolution: Resolution;
  readonly event: ResolutionApproved;
}

export class Resolution {
  private constructor(private readonly props: ResolutionProperties) {}

  /** Reconstruye una resolución ya persistida. */
  public static create(rawProps: ResolutionProperties): Resolution {
    if (!RESOLUTION_TYPES.includes(rawProps.type)) {
      throw new InvalidResolutionDataError('El tipo de resolución no es válido.');
    }
    if (!RESOLUTION_STATUSES.includes(rawProps.status)) {
      throw new InvalidResolutionDataError('El estado de la resolución no es válido.');
    }
    return new Resolution(rawProps);
  }

  /** Una resolución nueva siempre nace Registrada; el plan de mejora aún no está disponible (D6). */
  public static register(input: RegisterResolutionInput): Resolution {
    if (!RESOLUTION_TYPES.includes(input.type)) {
      throw new InvalidResolutionDataError('El tipo de resolución no es válido.');
    }
    if (!REGISTERABLE_RESOLUTION_TYPES.includes(input.type)) {
      throw new ResolutionTypeNotAvailableError();
    }
    const number = input.number.trim();
    if (
      number.length < 1 ||
      number.length > RESOLUTION_NUMBER_MAX_LENGTH ||
      !RESOLUTION_NUMBER_PATTERN.test(number)
    ) {
      throw new InvalidResolutionDataError(
        `El número de resolución debe tener entre 1 y ${RESOLUTION_NUMBER_MAX_LENGTH} caracteres: letras, dígitos, guion, barra, punto y espacio.`,
      );
    }
    if (!(input.issuedOn instanceof Date) || Number.isNaN(input.issuedOn.getTime())) {
      throw new InvalidResolutionDataError('La fecha de la resolución no es válida.');
    }
    if (!input.catalogVersionId || input.catalogVersionId.trim() === '') {
      throw new InvalidResolutionDataError(
        'La resolución debe estar vinculada a una versión del catálogo.',
      );
    }
    const now = input.now ?? new Date();
    return Resolution.create({
      id: input.id,
      type: input.type,
      number,
      issuedOn: input.issuedOn,
      status: 'REGISTERED',
      catalogVersionId: input.catalogVersionId,
      pdfFileId: null,
      approvedAt: null,
      approvedBy: null,
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get type(): ResolutionType {
    return this.props.type;
  }

  public get number(): string {
    return this.props.number;
  }

  public get issuedOn(): Date {
    return this.props.issuedOn;
  }

  public get status(): ResolutionStatus {
    return this.props.status;
  }

  public get catalogVersionId(): string | null {
    return this.props.catalogVersionId;
  }

  public get pdfFileId(): string | null {
    return this.props.pdfFileId;
  }

  public get approvedAt(): Date | null {
    return this.props.approvedAt;
  }

  public get approvedBy(): string | null {
    return this.props.approvedBy;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Registrada → Aprobada (RN-063, RS 5.8): exige el PDF firmado. Devuelve una resolución nueva y
   * el evento `ResolutionApproved`; la actual no cambia (RN-007).
   */
  public approve(input: ApproveResolutionInput): ApprovedResolution {
    assertTransition({
      from: this.props.status,
      to: 'APPROVED',
      hasSignedPdf: input.pdf !== null,
    });
    const approvedAt = input.now ?? new Date();
    const resolution = Resolution.create({
      ...this.props,
      status: 'APPROVED',
      pdfFileId: input.pdf?.fileId ?? null,
      approvedAt,
      approvedBy: input.actorId,
      updatedAt: approvedAt,
    });
    return {
      resolution,
      event: {
        resolutionId: this.props.id,
        type: this.props.type,
        catalogVersionId: this.props.catalogVersionId,
        approvedBy: input.actorId,
        approvedAt,
      },
    };
  }

  public snapshot(): ResolutionSnapshot {
    return {
      type: this.props.type,
      number: this.props.number,
      issuedOn: this.props.issuedOn.toISOString().slice(0, 10),
      status: this.props.status,
      catalogVersionId: this.props.catalogVersionId,
    };
  }
}
