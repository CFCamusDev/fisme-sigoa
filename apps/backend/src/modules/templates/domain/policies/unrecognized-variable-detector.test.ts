import { describe, expect, it } from 'vitest';
import { detectUnrecognizedVariables } from './unrecognized-variable-detector.js';

const ALLOWED_KEYS = ['program.name', 'logo.url', 'minutes.number'];

describe('detectUnrecognizedVariables (T-019-08)', () => {
  it('reports variables that the template does not declare', () => {
    const result = detectUnrecognizedVariables(
      '<p>{{program.name}} {{unknown.key}} {{other.missing}}</p>',
      ALLOWED_KEYS,
    );

    expect(result).toEqual({
      unrecognized: ['unknown.key', 'other.missing'],
      hasUnclosed: false,
    });
  });

  it('ignores repeated and well-formed declared variables', () => {
    const result = detectUnrecognizedVariables(
      '<p>{{program.name}} {{program.name}} {{unknown.key}} {{unknown.key}}</p>',
      ALLOWED_KEYS,
    );

    expect(result).toEqual({
      unrecognized: ['unknown.key'],
      hasUnclosed: false,
    });
  });

  it('reports empty, malformed and unclosed variables', () => {
    const result = detectUnrecognizedVariables(
      '<p>{{}} {{   }} {{ 7*7 }} {{Program.name}} {{minutes.number</p>',
      ALLOWED_KEYS,
    );

    expect(result).toEqual({
      unrecognized: ['(vacía)', '7*7', 'Program.name'],
      hasUnclosed: true,
    });
  });
});
