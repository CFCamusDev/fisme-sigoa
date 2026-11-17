import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { InvalidImportFileError } from '../../domain/errors/invalid-import-file-error.js';
import { requireExcelBody } from './require-excel-body.js';

function invokeMiddleware(body: unknown) {
  const req = { body } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  requireExcelBody(req, res, next);
  return next as unknown as ReturnType<typeof vi.fn>;
}

describe('requireExcelBody', () => {
  it('allows a non-empty Buffer with PK zip signature', () => {
    const next = invokeMiddleware(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]));
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects non-buffer bodies (e.g. wrong Content-Type leaving {})', () => {
    const next = invokeMiddleware({});
    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(InvalidImportFileError);
    expect((error as InvalidImportFileError).message).toContain('Envía el archivo .xlsx');
  });

  it('rejects empty buffers', () => {
    const next = invokeMiddleware(Buffer.alloc(0));
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(InvalidImportFileError);
  });

  it('rejects buffers without PK zip signature', () => {
    const next = invokeMiddleware(Buffer.from('not-an-xlsx-file', 'utf8'));
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(InvalidImportFileError);
  });
});
