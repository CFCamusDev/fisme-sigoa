import { z } from 'zod';

export const ANNEX_CODES = [
  'FO-01',
  'FO-02',
  'FO-03',
  'FO-04',
  'FO-05',
  'FO-06',
  'FO-07',
  'FO-08',
  'FO-09',
  'FO-10',
  'FO-11',
] as const;

export type AnnexCode = (typeof ANNEX_CODES)[number];

export interface AnnexCatalogEntry {
  readonly code: AnnexCode;
  readonly number: number;
  readonly name: string;
}

/** Catálogo cerrado de los 11 anexos oficiales del procedimiento PR-M01.02.01-EPIS-01. */
export const ANNEX_CATALOG: readonly AnnexCatalogEntry[] = [
  { code: 'FO-01', number: 1, name: 'Anexo 1. Cronograma' },
  { code: 'FO-02', number: 2, name: 'Anexo 2. Acta' },
  { code: 'FO-03', number: 3, name: 'Anexo 3. Lista de constituyentes' },
  { code: 'FO-04', number: 4, name: 'Anexo 4. Acciones de mejora' },
  { code: 'FO-05', number: 5, name: 'Anexo 5. Encuesta para establecer los OE' },
  { code: 'FO-06', number: 6, name: 'Anexo 6. Encuesta para medir los OE' },
  { code: 'FO-07', number: 7, name: 'Anexo 7. Plan Assessment' },
  { code: 'FO-08', number: 8, name: 'Anexo 8. Matriz de alineamiento' },
  { code: 'FO-09', number: 9, name: 'Anexo 9. Encuesta para establecer los AG' },
  { code: 'FO-10', number: 10, name: 'Anexo 10. Encuesta para medir los AG' },
  { code: 'FO-11', number: 11, name: 'Anexo 11. Procesamiento de la medición' },
] as const;

export const annexCodeParamsSchema = z
  .object({
    code: z.enum(ANNEX_CODES, {
      message: 'El código de anexo debe pertenecer al catálogo oficial (FO-01 a FO-11).',
    }),
  })
  .strict();

export type AnnexCodeParams = z.infer<typeof annexCodeParamsSchema>;

export const ANNEX_PDF_CONTENT_TYPE = 'application/pdf';
export const ANNEX_VERSION_HEADER = 'x-template-version';
