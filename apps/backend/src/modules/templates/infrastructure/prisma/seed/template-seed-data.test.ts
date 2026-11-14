import { TEMPLATE_CONTENT_MAX_LENGTH } from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import { TemplateVersion } from '../../../domain/entities/template-version.js';
import { validateTemplateContent } from '../../../domain/policies/template-content-policy.js';
import { INSTITUTION_NAME } from './template-seed-layout.js';
import { OFFICIAL_TEMPLATES } from './template-seed-data.js';
import { defineTemplate, extractVariableKeys } from './template-seed-types.js';
import { TEMPLATE_VARIABLE_LABELS } from './template-seed-variables.js';

const ANNEX_CODES = Array.from(
  { length: 11 },
  (_unused, index) => `FO-${String(index + 1).padStart(2, '0')}`,
);

describe('official template definitions (T-018-11, RN-040)', () => {
  it('declares unique template codes including the 11 annexes', () => {
    const codes = OFFICIAL_TEMPLATES.map((definition) => definition.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of ANNEX_CODES) {
      expect(codes).toContain(code);
    }
  });

  it.each(OFFICIAL_TEMPLATES.map((definition) => [definition.code, definition] as const))(
    '%s is a valid version 1 content',
    (_code, definition) => {
      expect(definition.content.length).toBeLessThanOrEqual(TEMPLATE_CONTENT_MAX_LENGTH);
      expect(() =>
        validateTemplateContent(
          definition.content,
          definition.variables.map((variable) => variable.key),
        ),
      ).not.toThrow();
      expect(() =>
        TemplateVersion.createDraft({
          id: 'v',
          templateId: 't',
          number: 1,
          content: definition.content,
        }),
      ).not.toThrow();
    },
  );

  it.each(OFFICIAL_TEMPLATES.map((definition) => [definition.code, definition] as const))(
    '%s declares exactly the variables it uses, each with a label',
    (_code, definition) => {
      const used = extractVariableKeys(definition.content).sort();
      const declared = definition.variables.map((variable) => variable.key).sort();
      expect(declared).toEqual(used);
      expect(declared.length).toBeGreaterThan(0);
      for (const variable of definition.variables) {
        expect(variable.label.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it.each(OFFICIAL_TEMPLATES.map((definition) => [definition.code, definition] as const))(
    '%s carries the institutional header and the official shield',
    (_code, definition) => {
      expect(definition.content).toContain(INSTITUTION_NAME);
      expect(definition.content).toContain(
        'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
      );
      expect(definition.content).toContain('Programa de Estudios de Ingeniería de Sistemas');
      expect(definition.content).toContain('src="{{logo.url}}"');
    },
  );

  it.each(OFFICIAL_TEMPLATES.map((definition) => [definition.code, definition] as const))(
    '%s keeps accents intact and loads no external resource',
    (_code, definition) => {
      expect(definition.content).not.toMatch(/Ã|Â|�/);
      expect(definition.content).not.toMatch(/https?:\/\//i);
      expect(definition.content).not.toContain('<link');
    },
  );

  it('derives catalog-dependent columns from collections, never from fixed text (RN-041)', () => {
    const byCode = new Map(OFFICIAL_TEMPLATES.map((definition) => [definition.code, definition]));
    expect(byCode.get('FO-04')?.content).toContain('data-repeat="objectives"');
    for (const code of ['FO-07', 'FO-08', 'FO-09', 'FO-10']) {
      expect(byCode.get(code)?.content).toContain('data-repeat="attributes"');
    }
    for (const code of ['FO-04', 'FO-05', 'FO-06']) {
      expect(byCode.get(code)?.content).not.toMatch(/OEP\d/);
    }
    for (const code of ['FO-07', 'FO-08', 'FO-09', 'FO-10']) {
      expect(byCode.get(code)?.content).not.toMatch(/AG-C\d{2}/);
    }
  });

  it('labels every variable of the dictionary and leaves no unused entry', () => {
    const used = new Set(
      OFFICIAL_TEMPLATES.flatMap((definition) => extractVariableKeys(definition.content)),
    );
    expect([...used].filter((key) => !(key in TEMPLATE_VARIABLE_LABELS))).toEqual([]);
    expect(Object.keys(TEMPLATE_VARIABLE_LABELS).filter((key) => !used.has(key))).toEqual([]);
  });

  it('rejects a template that uses a variable without a label', () => {
    expect(() =>
      defineTemplate({
        code: 'X-01',
        name: 'Prueba',
        type: 'ANNEX',
        content: '<p>{{unlabeled.key}}</p>',
      }),
    ).toThrow(/sin etiqueta/);
  });

  it('extracts variables once and in order of appearance', () => {
    expect(extractVariableKeys('<p>{{b.x}} {{a.y}} {{b.x}}</p>')).toEqual(['b.x', 'a.y']);
    expect(extractVariableKeys('<p>sin variables</p>')).toEqual([]);
  });
});
