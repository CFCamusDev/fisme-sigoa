import { describe, expect, it, vi } from 'vitest';
import * as permissionGuard from '@/lib/permission-guard';
import { Route } from './plantillas';

type SearchValidator = (search: Record<string, unknown>) => { id?: string };

function validate(search: Record<string, unknown>) {
  return (Route.options.validateSearch as SearchValidator)(search);
}

describe('TemplatesRoute (/plantillas) (HU-018, T-018-19)', () => {
  it('defines a beforeLoad guard requiring plantilla.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('keeps the open template in the URL', () => {
    expect(validate({ id: 'tpl-1' })).toEqual({ id: 'tpl-1' });
  });

  it('accepts an empty search and drops unknown parameters', () => {
    expect(validate({})).toEqual({ id: undefined });
    expect(validate({ id: 'tpl-1', other: 'x' })).toEqual({ id: 'tpl-1' });
  });

  it('ignores identifiers that are empty, too long or not text', () => {
    expect(validate({ id: '' })).toEqual({ id: undefined });
    expect(validate({ id: 'x'.repeat(65) })).toEqual({ id: undefined });
    expect(validate({ id: 42 })).toEqual({ id: undefined });
    expect(validate({ id: { value: 'tpl-1' } })).toEqual({ id: undefined });
  });

  it('redirects to the template editor route when id search param is present', async () => {
    const spy = vi.spyOn(permissionGuard, 'guardPermission').mockResolvedValueOnce(undefined);
    const beforeLoad = Route.options.beforeLoad as (ctx: {
      search: { id?: string };
    }) => Promise<unknown>;
    try {
      await beforeLoad({ search: { id: 'tpl-1' } });
      expect.fail('Expected beforeLoad to throw a redirect');
    } catch (error) {
      expect(error).toMatchObject({
        options: {
          to: '/plantillas/$templateId',
          params: { templateId: 'tpl-1' },
        },
      });
    } finally {
      spy.mockRestore();
    }
  });
});
