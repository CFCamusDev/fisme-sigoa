import { InvalidCatalogDataError } from '../errors/invalid-catalog-data-error.js';

/** Límites compartidos por OE y AG; coinciden con los `CHECK` de la base de datos. */
export const CATALOG_ITEM_LIMITS = {
  codeRegex: /^[A-Z][A-Z0-9-]{1,19}$/,
  statementMaxLength: 2000,
  nameMaxLength: 120,
} as const;

/** Máximo de OE y de AG por versión (D7); coincide con `CATALOG_MAX_ITEMS` de `@sigoa/shared`. */
export const CATALOG_MAX_ITEMS = 100;

export function validateCatalogCode(rawCode: string): string {
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!CATALOG_ITEM_LIMITS.codeRegex.test(code)) {
    throw new InvalidCatalogDataError(
      'El código debe tener de 2 a 20 caracteres: mayúsculas, números y guion, empezando por una letra.',
    );
  }
  return code;
}

export function validateCatalogStatement(rawStatement: string): string {
  const statement = typeof rawStatement === 'string' ? rawStatement.trim() : '';
  if (statement.length < 1 || statement.length > CATALOG_ITEM_LIMITS.statementMaxLength) {
    throw new InvalidCatalogDataError(
      `El enunciado debe tener entre 1 y ${CATALOG_ITEM_LIMITS.statementMaxLength} caracteres.`,
    );
  }
  return statement;
}

export function validateCatalogName(rawName: string): string {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (name.length < 1 || name.length > CATALOG_ITEM_LIMITS.nameMaxLength) {
    throw new InvalidCatalogDataError(
      `El nombre debe tener entre 1 y ${CATALOG_ITEM_LIMITS.nameMaxLength} caracteres.`,
    );
  }
  return name;
}

export function validateCatalogOrder(order: number): number {
  if (!Number.isInteger(order) || order < 1) {
    throw new InvalidCatalogDataError('El orden debe ser un entero mayor o igual a 1.');
  }
  return order;
}
