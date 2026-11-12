import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/app-error.js';
import type { FileValidationRules } from './file-validator.js';
import { validateFile } from './file-validator.js';

describe('validateFile', () => {
  const defaultRules: FileValidationRules = {
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 10 * 1024 * 1024, // 10 MB explícito para la prueba (RN-005)
  };

  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
  );
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

  it('accepts valid PDF file matching magic bytes and within size limit', () => {
    expect(() =>
      validateFile(
        {
          content: validPdfBuffer,
          originalName: 'evidencia.pdf',
          mimeType: 'application/pdf',
        },
        defaultRules,
      ),
    ).not.toThrow();
  });

  it('accepts valid JPEG file matching magic bytes and within size limit', () => {
    expect(() =>
      validateFile(
        {
          content: validJpegBuffer,
          originalName: 'foto.jpg',
          mimeType: 'image/jpeg',
        },
        defaultRules,
      ),
    ).not.toThrow();
  });

  it('accepts valid PNG file matching magic bytes and within size limit', () => {
    expect(() =>
      validateFile(
        {
          content: validPngBuffer,
          originalName: 'captura.png',
          mimeType: 'image/png',
        },
        defaultRules,
      ),
    ).not.toThrow();
  });

  it('rejects an empty file buffer with Spanish message', () => {
    expect(() =>
      validateFile(
        {
          content: Buffer.alloc(0),
          originalName: 'vacio.pdf',
          mimeType: 'application/pdf',
        },
        defaultRules,
      ),
    ).toThrowError(new ValidationError('El archivo no puede estar vacío'));
  });

  it('rejects a file whose declared MIME type is not allowed', () => {
    expect(() =>
      validateFile(
        {
          content: Buffer.from('script contents'),
          originalName: 'script.sh',
          mimeType: 'application/x-sh',
        },
        defaultRules,
      ),
    ).toThrowError(new ValidationError('El tipo de archivo no está permitido'));
  });

  it('rejects a file with declared PDF mime type but non-matching magic signature (spoofed extension)', () => {
    const fakePdf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00'); // Windows executable header disguised as PDF
    expect(() =>
      validateFile(
        {
          content: fakePdf,
          originalName: 'malware.pdf',
          mimeType: 'application/pdf',
        },
        defaultRules,
      ),
    ).toThrowError(
      new ValidationError('El contenido del archivo no coincide con el formato PDF declarado'),
    );
  });

  it('rejects a file with declared JPEG mime type but invalid header signature', () => {
    const fakeJpeg = Buffer.from('GIF89a...');
    expect(() =>
      validateFile(
        {
          content: fakeJpeg,
          originalName: 'fake.jpg',
          mimeType: 'image/jpeg',
        },
        defaultRules,
      ),
    ).toThrowError(
      new ValidationError('El contenido del archivo no coincide con el formato JPEG declarado'),
    );
  });

  it('rejects a file with declared PNG mime type but invalid header signature', () => {
    const fakePng = Buffer.from('RIFF....WEBP');
    expect(() =>
      validateFile(
        {
          content: fakePng,
          originalName: 'fake.png',
          mimeType: 'image/png',
        },
        defaultRules,
      ),
    ).toThrowError(
      new ValidationError('El contenido del archivo no coincide con el formato PNG declarado'),
    );
  });

  it('accepts a file whose size exactly matches the maximum allowed bytes', () => {
    const limit = 1024; // 1 KB rule
    const pdfHeader = Buffer.from('%PDF-');
    const padding = Buffer.alloc(limit - pdfHeader.length, 0x20);
    const exactBuffer = Buffer.concat([pdfHeader, padding]);

    expect(exactBuffer.length).toBe(limit);

    expect(() =>
      validateFile(
        {
          content: exactBuffer,
          originalName: 'exacto.pdf',
          mimeType: 'application/pdf',
        },
        { allowedMimeTypes: ['application/pdf'], maxBytes: limit },
      ),
    ).not.toThrow();
  });

  it('rejects a file whose size exceeds the limit by 1 byte', () => {
    const limit = 1024;
    const pdfHeader = Buffer.from('%PDF-');
    const padding = Buffer.alloc(limit - pdfHeader.length + 1, 0x20);
    const oversizedBuffer = Buffer.concat([pdfHeader, padding]);

    expect(oversizedBuffer.length).toBe(limit + 1);

    expect(() =>
      validateFile(
        {
          content: oversizedBuffer,
          originalName: 'excedido.pdf',
          mimeType: 'application/pdf',
        },
        { allowedMimeTypes: ['application/pdf'], maxBytes: limit },
      ),
    ).toThrowError(new ValidationError('El archivo excede el tamaño máximo permitido'));
  });
});
