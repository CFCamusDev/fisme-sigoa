import { TEMPLATE_VARIABLE_KEY_PATTERN } from '@sigoa/shared';

const VARIABLE_PATTERN = /\{\{([\s\S]*?)\}\}/g;

export interface UnrecognizedVariablesResult {
  readonly unrecognized: readonly string[];
  readonly hasUnclosed: boolean;
}

/**
 * Recorre las expresiones `{{…}}` del contenido y devuelve en orden de aparición
 * (sin repetidos) las que están vacías, tienen formato inválido o no pertenecen a `allowedKeys`,
 * además de indicar si quedó alguna apertura `{{` sin cierre `}}`.
 */
export function detectUnrecognizedVariables(
  content: string,
  allowedKeys: readonly string[],
): UnrecognizedVariablesResult {
  const allowed = new Set(allowedKeys);
  const seen = new Set<string>();
  const unrecognized: string[] = [];

  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const rawKey = match[1] ?? '';
    if (!TEMPLATE_VARIABLE_KEY_PATTERN.test(rawKey) || !allowed.has(rawKey)) {
      const label = rawKey.trim() === '' ? '(vacía)' : rawKey.trim();
      if (!seen.has(label)) {
        seen.add(label);
        unrecognized.push(label);
      }
    }
  }

  const hasUnclosed = content.replace(VARIABLE_PATTERN, '').includes('{{');
  return { unrecognized, hasUnclosed };
}
