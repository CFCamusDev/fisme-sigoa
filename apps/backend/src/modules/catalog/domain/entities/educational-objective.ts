import {
  validateCatalogCode,
  validateCatalogOrder,
  validateCatalogStatement,
} from './catalog-limits.js';

export interface EducationalObjectiveProperties {
  readonly id: string;
  readonly versionId: string;
  code: string;
  statement: string;
  order: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EducationalObjective {
  private constructor(private readonly props: EducationalObjectiveProperties) {}

  public static create(rawProps: EducationalObjectiveProperties): EducationalObjective {
    return new EducationalObjective({
      ...rawProps,
      code: validateCatalogCode(rawProps.code),
      statement: validateCatalogStatement(rawProps.statement),
      order: validateCatalogOrder(rawProps.order),
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get versionId(): string {
    return this.props.versionId;
  }

  public get code(): string {
    return this.props.code;
  }

  public get statement(): string {
    return this.props.statement;
  }

  public get order(): number {
    return this.props.order;
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

  /** Alta de un OE nuevo en una versión (HU-014). */
  public static createNew(input: {
    id: string;
    versionId: string;
    code: string;
    statement: string;
    order: number;
    actorId: string;
    now: Date;
  }): EducationalObjective {
    return EducationalObjective.create({
      id: input.id,
      versionId: input.versionId,
      code: input.code,
      statement: input.statement,
      order: input.order,
      createdBy: input.actorId,
      updatedBy: input.actorId,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Devuelve un OE nuevo con código y enunciado editados; conserva id, versión y orden. */
  public edit(input: {
    code: string;
    statement: string;
    actorId: string;
    now: Date;
  }): EducationalObjective {
    return EducationalObjective.create({
      ...this.props,
      code: input.code,
      statement: input.statement,
      updatedBy: input.actorId,
      updatedAt: input.now,
    });
  }

  /** Devuelve un OE nuevo con otro orden. */
  public withOrder(order: number, actorId: string, now: Date): EducationalObjective {
    return EducationalObjective.create({
      ...this.props,
      order,
      updatedBy: actorId,
      updatedAt: now,
    });
  }

  /** `true` si el código y el enunciado ya valen lo indicado (edición sin cambios). */
  public hasSameContent(input: { code: string; statement: string }): boolean {
    return (
      this.props.code === validateCatalogCode(input.code) &&
      this.props.statement === validateCatalogStatement(input.statement)
    );
  }

  /** Copia el OE a otra versión conservando código, texto y orden. */
  public copyTo(
    newId: string,
    versionId: string,
    actorId?: string,
    now: Date = new Date(),
  ): EducationalObjective {
    return EducationalObjective.create({
      id: newId,
      versionId,
      code: this.props.code,
      statement: this.props.statement,
      order: this.props.order,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
