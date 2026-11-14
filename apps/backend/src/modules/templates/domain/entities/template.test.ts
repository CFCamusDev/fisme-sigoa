import { describe, expect, it } from 'vitest';
import { InvalidTemplateDataError } from '../errors/index.js';
import { Template, type TemplateProperties } from './template.js';

const VALID: TemplateProperties = {
  id: 'tpl-1',
  code: 'FO-01',
  name: 'Anexo 1',
  type: 'ANNEX',
  variables: [{ key: 'programName', label: 'Nombre del programa' }],
};

describe('Template', () => {
  it('exposes its properties', () => {
    const template = Template.create(VALID);
    expect(template.id).toBe('tpl-1');
    expect(template.code).toBe('FO-01');
    expect(template.name).toBe('Anexo 1');
    expect(template.type).toBe('ANNEX');
    expect(template.variables).toEqual([{ key: 'programName', label: 'Nombre del programa' }]);
  });

  it('accepts a template without variables', () => {
    expect(Template.create({ ...VALID, variables: [] }).variables).toEqual([]);
  });

  it('does not share the variables list with its input', () => {
    const variables = [{ key: 'a', label: 'A' }];
    const template = Template.create({ ...VALID, variables });
    variables.push({ key: 'b', label: 'B' });
    expect(template.variables).toHaveLength(1);
  });

  it.each([['code'], ['name']] as const)('rejects a blank %s', (field) => {
    expect(() => Template.create({ ...VALID, [field]: '  ' })).toThrow(InvalidTemplateDataError);
  });

  it('rejects an unknown type', () => {
    expect(() => Template.create({ ...VALID, type: 'OTHER' as never })).toThrow(
      InvalidTemplateDataError,
    );
  });
});
