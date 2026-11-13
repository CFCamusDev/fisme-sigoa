import {
  validateCatalogCode,
  validateCatalogName,
  validateCatalogOrder,
  validateCatalogStatement,
} from './catalog-limits.js';

export interface GraduateAttributeProperties {
  readonly id: string;
  readonly versionId: string;
  code: string;
  name: string;
  statement: string;
  order: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class GraduateAttribute {
  private constructor(private readonly props: GraduateAttributeProperties) {}

  public static create(rawProps: GraduateAttributeProperties): GraduateAttribute {
    return new GraduateAttribute({
      ...rawProps,
      code: validateCatalogCode(rawProps.code),
      name: validateCatalogName(rawProps.name),
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

  public get name(): string {
    return this.props.name;
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

  /** Alta de un AG nuevo en una versión (HU-014). */
  public static createNew(input: {
    id: string;
    versionId: string;
    code: string;
    name: string;
    statement: string;
    order: number;
    actorId: string;
    now: Date;
  }): GraduateAttribute {
    return GraduateAttribute.create({
      id: input.id,
      versionId: input.versionId,
      code: input.code,
      name: input.name,
      statement: input.statement,
      order: input.order,
      createdBy: input.actorId,
      updatedBy: input.actorId,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Devuelve un AG nuevo con código, nombre y enunciado editados; conserva id, versión y orden. */
  public edit(input: {
    code: string;
    name: string;
    statement: string;
    actorId: string;
    now: Date;
  }): GraduateAttribute {
    return GraduateAttribute.create({
      ...this.props,
      code: input.code,
      name: input.name,
      statement: input.statement,
      updatedBy: input.actorId,
      updatedAt: input.now,
    });
  }

  /** Devuelve un AG nuevo con otro orden. */
  public withOrder(order: number, actorId: string, now: Date): GraduateAttribute {
    return GraduateAttribute.create({
      ...this.props,
      order,
      updatedBy: actorId,
      updatedAt: now,
    });
  }

  /** `true` si código, nombre y enunciado ya valen lo indicado (edición sin cambios). */
  public hasSameContent(input: { code: string; name: string; statement: string }): boolean {
    return (
      this.props.code === validateCatalogCode(input.code) &&
      this.props.name === validateCatalogName(input.name) &&
      this.props.statement === validateCatalogStatement(input.statement)
    );
  }

  /** Copia el AG a otra versión conservando código, nombre, texto y orden. */
  public copyTo(
    newId: string,
    versionId: string,
    actorId?: string,
    now: Date = new Date(),
  ): GraduateAttribute {
    return GraduateAttribute.create({
      id: newId,
      versionId,
      code: this.props.code,
      name: this.props.name,
      statement: this.props.statement,
      order: this.props.order,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
