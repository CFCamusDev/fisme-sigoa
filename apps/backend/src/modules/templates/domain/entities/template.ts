import { InvalidTemplateDataError } from '../errors/invalid-template-data-error.js';

export const TEMPLATE_TYPES = ['ANNEX', 'MINUTES', 'SURVEY', 'INSTRUMENT'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/** Variable permitida en el HTML de la plantilla (`{{key}}`). */
export interface TemplateVariable {
  readonly key: string;
  readonly label: string;
}

export interface TemplateProperties {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: TemplateType;
  readonly variables: readonly TemplateVariable[];
}

/** Plantilla oficial: catálogo cerrado que no se crea por API (HU-018, D2). */
export class Template {
  private constructor(private readonly props: TemplateProperties) {}

  public static create(rawProps: TemplateProperties): Template {
    if (rawProps.code.trim().length === 0) {
      throw new InvalidTemplateDataError('El código de la plantilla no puede estar vacío.');
    }
    if (rawProps.name.trim().length === 0) {
      throw new InvalidTemplateDataError('El nombre de la plantilla no puede estar vacío.');
    }
    if (!TEMPLATE_TYPES.includes(rawProps.type)) {
      throw new InvalidTemplateDataError('El tipo de la plantilla no es válido.');
    }
    return new Template({ ...rawProps, variables: [...rawProps.variables] });
  }

  public get id(): string {
    return this.props.id;
  }

  public get code(): string {
    return this.props.code;
  }

  public get name(): string {
    return this.props.name;
  }

  public get type(): TemplateType {
    return this.props.type;
  }

  public get variables(): readonly TemplateVariable[] {
    return this.props.variables;
  }
}
