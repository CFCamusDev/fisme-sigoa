import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { getStakeholderImportErrorMessage } from './stakeholder-import-error-message';
import { STAKEHOLDER_IMPORT_ROW_BADGE } from './stakeholder-import-labels';

describe('stakeholder-import-error-message & labels', () => {
  it('returns specific messages for each HTTP status and NotReadableError', () => {
    expect(
      getStakeholderImportErrorMessage(new DOMException('File changed', 'NotReadableError')),
    ).toBe('No se pudo leer el archivo; selecciónalo de nuevo.');

    expect(
      getStakeholderImportErrorMessage(
        new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'El archivo supera 2 MiB.',
          status: 400,
        }),
      ),
    ).toBe('El archivo supera 2 MiB.');

    expect(
      getStakeholderImportErrorMessage(
        new ApiError({ code: 'FORBIDDEN', message: 'Forbidden', status: 403 }),
      ),
    ).toBe('No tienes permiso para importar constituyentes.');

    expect(
      getStakeholderImportErrorMessage(
        new ApiError({ code: 'NOT_FOUND', message: 'Not found', status: 404 }),
      ),
    ).toBe('La lista de constituyentes ya no existe. Recarga la página.');

    expect(
      getStakeholderImportErrorMessage(
        new ApiError({ code: 'CONFLICT', message: 'Conflicto de documento', status: 409 }),
      ),
    ).toBe('Conflicto de documento');

    expect(
      getStakeholderImportErrorMessage(
        new ApiError({ code: 'INTERNAL_ERROR', message: 'Error', status: 500 }),
      ),
    ).toContain('problema del servidor');
  });

  it('maps each import row status to StatusBadge config', () => {
    expect(STAKEHOLDER_IMPORT_ROW_BADGE.NEW).toEqual({ status: 'ACTIVE', label: 'Nuevo' });
    expect(STAKEHOLDER_IMPORT_ROW_BADGE.EXISTING).toEqual({
      status: 'REGISTERED',
      label: 'Ya registrado',
    });
    expect(STAKEHOLDER_IMPORT_ROW_BADGE.ALREADY_IN_LIST).toEqual({
      status: 'INACTIVE',
      label: 'Ya en la lista',
    });
    expect(STAKEHOLDER_IMPORT_ROW_BADGE.INVALID).toEqual({
      status: 'VOIDED',
      label: 'Con errores',
    });
  });
});
