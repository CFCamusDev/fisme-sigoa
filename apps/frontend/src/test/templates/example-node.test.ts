/**
 * Plantilla copiable: prueba unitaria sin DOM (proyecto `node`, < 5 ms).
 *
 * Cómo usarla:
 * 1. Copia este archivo en `src/lib/`, `src/features/<feature>/{lib,schemas,api}/` o una ruta
 *    listada en `apps/frontend/vitest-projects.json`.
 * 2. Evita importar `@testing-library/*`, `react-dom`, `window`, `document` o `localStorage`
 *    (la regla `dom-in-node` de `check-test-patterns` falla si los usas en este proyecto).
 * 3. Cambia el caso de ejemplo por la función pura, esquema Zod o adaptador HTTP con MSW.
 */
import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/date';

describe('Template: unitaria sin DOM en proyecto node', () => {
  it('formats an ISO date without touching the DOM', () => {
    expect(formatDate('2026-11-15T00:00:00.000Z')).toBe('15/11/2026');
  });
});
