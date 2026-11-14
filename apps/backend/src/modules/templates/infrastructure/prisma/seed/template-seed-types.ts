import { TEMPLATE_VARIABLE_KEY_PATTERN } from '@sigoa/shared';
import type { TemplateType } from '../../../domain/entities/template.js';
import { TEMPLATE_VARIABLE_LABELS } from './template-seed-variables.js';

export interface TemplateSeedVariable {
  readonly key: string;
  readonly label: string;
}

export interface TemplateSeedDefinition {
  readonly code: string;
  readonly name: string;
  readonly type: TemplateType;
  readonly variables: readonly TemplateSeedVariable[];
  readonly content: string;
}

export interface TemplateSeedInput {
  readonly code: string;
  readonly name: string;
  readonly type: TemplateType;
  readonly content: string;
}

/** Claves `{{clave}}` del contenido, sin repetir y en orden de aparición. */
export function extractVariableKeys(content: string): string[] {
  const keys: string[] = [];
  for (const match of content.matchAll(/\{\{([^{}]*)\}\}/g)) {
    const key = match[1] ?? '';
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Arma la definición declarando exactamente las variables que el HTML usa, con su etiqueta del
 * diccionario común: ninguna variable queda usada sin declarar ni declarada sin usar.
 */
export function defineTemplate(input: TemplateSeedInput): TemplateSeedDefinition {
  const variables = extractVariableKeys(input.content).map((key) => {
    const label = TEMPLATE_VARIABLE_LABELS[key];
    if (!TEMPLATE_VARIABLE_KEY_PATTERN.test(key) || label === undefined) {
      throw new Error(`La plantilla ${input.code} usa la variable sin etiqueta o inválida: ${key}`);
    }
    return { key, label };
  });
  return { ...input, variables };
}
