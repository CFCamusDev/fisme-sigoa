import { InvalidTemplateDataError } from '../errors/invalid-template-data-error.js';
import { TemplateVersionNotEditableError } from '../errors/template-version-not-editable-error.js';
import { assertTransition } from '../policies/template-version-state-machine.js';

import { TEMPLATE_CONTENT_MAX_LENGTH } from './template-limits.js';
import {
  TEMPLATE_VERSION_STATUSES,
  type TemplateVersionStatus,
} from './template-version-status.js';

export { TEMPLATE_VERSION_STATUSES, type TemplateVersionStatus };

export interface TemplateVersionProperties {
  readonly id: string;
  readonly templateId: string;
  readonly number: number;
  status: TemplateVersionStatus;
  content: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDraftInput {
  id: string;
  templateId: string;
  number: number;
  content: string;
  actorId?: string;
  now?: Date;
}

export interface TemplateLifecycleInput {
  actorId: string;
  now?: Date;
}

/** Alias de tipo (no interfaz) para que sirva como carga de auditoría. */
export type TemplateVersionSnapshot = {
  readonly templateId: string;
  readonly number: number;
  readonly status: TemplateVersionStatus;
};

function assertValidContent(content: string): void {
  if (content.trim().length === 0) {
    throw new InvalidTemplateDataError('El contenido de la plantilla no puede estar vacío.');
  }
  if (content.length > TEMPLATE_CONTENT_MAX_LENGTH) {
    throw new InvalidTemplateDataError(
      `El contenido de la plantilla no puede superar ${TEMPLATE_CONTENT_MAX_LENGTH} caracteres.`,
    );
  }
}

export class TemplateVersion {
  private constructor(private readonly props: TemplateVersionProperties) {}

  /** Reconstruye una versión ya persistida. */
  public static create(rawProps: TemplateVersionProperties): TemplateVersion {
    if (!Number.isInteger(rawProps.number) || rawProps.number < 1) {
      throw new InvalidTemplateDataError(
        'El número de versión debe ser un entero mayor o igual a 1.',
      );
    }
    if (!TEMPLATE_VERSION_STATUSES.includes(rawProps.status)) {
      throw new InvalidTemplateDataError('El estado de la versión de la plantilla no es válido.');
    }
    assertValidContent(rawProps.content);
    const published = rawProps.status !== 'DRAFT';
    if (published !== (rawProps.publishedAt !== null)) {
      throw new InvalidTemplateDataError(
        'Solo las versiones publicadas u obsoletas tienen fecha de publicación.',
      );
    }
    return new TemplateVersion({ ...rawProps });
  }

  /** Una versión nueva siempre nace en Borrador. */
  public static createDraft(input: CreateTemplateDraftInput): TemplateVersion {
    const now = input.now ?? new Date();
    return TemplateVersion.create({
      id: input.id,
      templateId: input.templateId,
      number: input.number,
      status: 'DRAFT',
      content: input.content,
      publishedAt: null,
      publishedBy: null,
      createdBy: input.actorId ?? null,
      updatedBy: input.actorId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get templateId(): string {
    return this.props.templateId;
  }

  public get number(): number {
    return this.props.number;
  }

  public get status(): TemplateVersionStatus {
    return this.props.status;
  }

  public get content(): string {
    return this.props.content;
  }

  public get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  public get publishedBy(): string | null {
    return this.props.publishedBy;
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

  /** Solo un Borrador admite cambios de contenido (RN-007). Devuelve una versión nueva. */
  public withContent(content: string, actorId: string, now: Date = new Date()): TemplateVersion {
    if (this.props.status !== 'DRAFT') {
      throw new TemplateVersionNotEditableError();
    }
    return TemplateVersion.create({
      ...this.props,
      content,
      updatedBy: actorId,
      updatedAt: now,
    });
  }

  /** Borrador → Publicada (RF-018). Devuelve una versión nueva; la actual no cambia. */
  public publish(input: TemplateLifecycleInput): TemplateVersion {
    assertTransition(this.props.status, 'PUBLISHED');
    const now = input.now ?? new Date();
    return TemplateVersion.create({
      ...this.props,
      status: 'PUBLISHED',
      publishedAt: now,
      publishedBy: input.actorId,
      updatedBy: input.actorId,
      updatedAt: now,
    });
  }

  /** Publicada → Obsoleta cuando se publica una versión posterior (RF-018). */
  public markObsolete(input: TemplateLifecycleInput): TemplateVersion {
    assertTransition(this.props.status, 'OBSOLETE');
    return TemplateVersion.create({
      ...this.props,
      status: 'OBSOLETE',
      updatedBy: input.actorId,
      updatedAt: input.now ?? new Date(),
    });
  }

  public snapshot(): TemplateVersionSnapshot {
    return {
      templateId: this.props.templateId,
      number: this.props.number,
      status: this.props.status,
    };
  }
}
