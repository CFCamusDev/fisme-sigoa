import { templateVariablesSchema } from '@sigoa/shared';
import { Template, type TemplateType } from '../../domain/entities/template.js';
import { InvalidTemplateDataError } from '../../domain/errors/invalid-template-data-error.js';

export interface PrismaTemplateRow {
  id: string;
  code: string;
  name: string;
  type: TemplateType;
  variables: unknown;
}

/** Valida `variables` con el esquema compartido: una fila con JSON mal formado no entra al dominio. */
export function mapPrismaTemplateRowToDomain(row: PrismaTemplateRow): Template {
  const variables = templateVariablesSchema.safeParse(row.variables);
  if (!variables.success) {
    throw new InvalidTemplateDataError(`Las variables de la plantilla ${row.code} no son válidas.`);
  }
  return Template.create({
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    variables: variables.data,
  });
}
