import { expect } from 'vitest';
import { STATUS } from '@/lib/status';

/**
 * Helper de pruebas que comprueba que cada valor de un enum o lista de estados
 * tenga una entrada registrada en STATUS con etiqueta válida en español.
 */
export function expectStatusCoverage(enumValues: readonly string[] | Record<string, string>): void {
  const values = Array.isArray(enumValues) ? enumValues : Object.values(enumValues);
  for (const val of values) {
    const descriptor = (STATUS as Record<string, { label: string; tone: string } | undefined>)[val];
    expect(
      descriptor,
      `El estado "${val}" debe tener entrada registrada en el mapa STATUS`,
    ).toBeDefined();
    if (descriptor) {
      expect(
        descriptor.label.trim().length,
        `La etiqueta para "${val}" no puede estar vacía`,
      ).toBeGreaterThan(0);
      expect(
        descriptor.label,
        `La etiqueta para "${val}" debe ser en español y distinta del enum en inglés`,
      ).not.toBe(val);
    }
  }
}
