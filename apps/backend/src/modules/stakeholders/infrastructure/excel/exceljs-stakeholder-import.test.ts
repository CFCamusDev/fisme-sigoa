import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ImportTemplateMismatchError } from '../../domain/errors/import-template-mismatch-error.js';
import { ImportTooManyRowsError } from '../../domain/errors/import-too-many-rows-error.js';
import { InvalidImportFileError } from '../../domain/errors/invalid-import-file-error.js';
import { getStakeholderImportColumns } from '../../domain/policies/stakeholder-import-columns.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { ExcelJsStakeholderImportFileReader } from './exceljs-stakeholder-import-file-reader.js';
import { ExcelJsStakeholderImportTemplateBuilder } from './exceljs-stakeholder-import-template-builder.js';

async function buildWorkbookBuffer(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<ExcelJS.CellValue>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Constituyentes');
  sheet.addRow([...headers]);
  for (const row of rows) {
    sheet.addRow([...row]);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('ExcelJsStakeholderImportFileReader & TemplateBuilder', () => {
  const reader = new ExcelJsStakeholderImportFileReader();
  const builder = new ExcelJsStakeholderImportTemplateBuilder();

  it('reads the rows of the employers template', async () => {
    const headers = getStakeholderImportColumns('EMPLOYER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      [
        '20123456789',
        'Andes Tech SAC',
        'Tecnologia',
        'Carlos Mendoza',
        'contacto@example.com',
        '987654321',
        'Gerente',
      ],
    ]);

    const rows = await reader.read(buffer, 'EMPLOYER');

    expect(rows).toEqual([
      {
        rowNumber: 2,
        values: {
          document: '20123456789',
          fullName: 'Andes Tech SAC',
          sector: 'Tecnologia',
          representative: 'Carlos Mendoza',
          email: 'contacto@example.com',
          mobile: '987654321',
          position: 'Gerente',
        },
      },
    ]);
  });

  it('rejects a file that is not an xlsx', async () => {
    const fakeBuffer = Buffer.from('not-an-xlsx-file', 'utf8');

    await expect(reader.read(fakeBuffer, 'TEACHER')).rejects.toBeInstanceOf(InvalidImportFileError);
  });

  it('rejects headers of another list type', async () => {
    const teacherHeaders = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(teacherHeaders, [
      ['45678912', 'Docente Uno', 'docente@example.com', '987654321'],
    ]);

    await expect(reader.read(buffer, 'GRADUATE')).rejects.toBeInstanceOf(
      ImportTemplateMismatchError,
    );
  });

  it('stops at row 501', async () => {
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const manyRows = Array.from({ length: 501 }, (_, index) => [
      String(10000000 + index),
      `Docente ${index + 1}`,
      `docente${index + 1}@example.com`,
      '987654321',
    ]);
    const buffer = await buildWorkbookBuffer(headers, manyRows);

    await expect(reader.read(buffer, 'TEACHER')).rejects.toBeInstanceOf(ImportTooManyRowsError);
  });

  it('reads formulas as text without evaluating them', async () => {
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      [
        '45678912',
        { formula: 'HYPERLINK("https://example.com","Click")' },
        'docente@example.com',
        '987654321',
      ],
    ]);

    const rows = await reader.read(buffer, 'TEACHER');

    expect(rows[0]?.values.fullName).toBe('=HYPERLINK("https://example.com","Click")');
  });

  it('keeps leading zeros written as text', async () => {
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['01234567', 'Docente Cero', 'docente@example.com', '987654321'],
    ]);

    const rows = await reader.read(buffer, 'TEACHER');

    expect(rows[0]?.values.document).toBe('01234567');
  });

  it('builds a template with the headers of each list type', async () => {
    const buffer = await builder.build('GRADUATE');
    const expectedHeaders = getStakeholderImportColumns('GRADUATE').map((col) => col.header);

    const parsedWorkbook = new ExcelJS.Workbook();
    await parsedWorkbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const dataSheet = parsedWorkbook.getWorksheet('Constituyentes');
    const instructionsSheet = parsedWorkbook.getWorksheet('Instrucciones');

    expect(dataSheet).toBeDefined();
    expect(instructionsSheet).toBeDefined();

    const actualHeaders = expectedHeaders.map(
      (_, idx) => dataSheet?.getRow(1).getCell(idx + 1).value,
    );
    expect(actualHeaders).toEqual(expectedHeaders);
    expect(dataSheet?.getColumn(1).numFmt).toBe('@');
  });

  it('limits concurrent reads to two', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const limitedReader = new ExcelJsStakeholderImportFileReader({ limiter });
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['01234567', 'Docente Uno', 'docente@example.com', '987654321'],
    ]);

    let active = 0;
    let peak = 0;
    const trackedRead = async () =>
      limiter.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 25));
        active -= 1;
      });

    await Promise.all([trackedRead(), trackedRead(), trackedRead(), trackedRead()]);
    expect(peak).toBe(2);

    const results = await Promise.all([
      limitedReader.read(buffer, 'TEACHER'),
      limitedReader.read(buffer, 'TEACHER'),
      limitedReader.read(buffer, 'TEACHER'),
    ]);
    expect(results).toHaveLength(3);
  });
});
