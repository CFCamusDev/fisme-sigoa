import { STAKEHOLDER_IMPORT_MAX_ROWS } from '@sigoa/shared';
import ExcelJS from 'exceljs';
import {
  STAKEHOLDER_GRADUATION_YEAR_MAX,
  STAKEHOLDER_GRADUATION_YEAR_MIN,
} from '../../domain/entities/stakeholder-enums.js';
import type { StakeholderListType } from '../../domain/entities/stakeholder-list-enums.js';
import { getStakeholderImportColumns } from '../../domain/policies/stakeholder-import-columns.js';
import type { StakeholderImportTemplateBuilder } from '../../domain/ports/stakeholder-import-template-builder.js';

const EXAMPLE_VALUES_BY_TYPE: Record<StakeholderListType, readonly string[]> = {
  EMPLOYER: [
    '20123456789',
    'Empresa Ejemplo SAC',
    'Tecnología',
    'Carlos Mendoza',
    'contacto@ejemplo.com',
    '987654321',
    'Gerente General',
  ],
  ADVISORY_BOARD: [
    '01234567',
    'Ana Torres Vega',
    'Colegio de Ingenieros',
    'Evaluadora externa',
    'ana.torres@ejemplo.com',
    '987654322',
  ],
  GRADUATE: ['01234567', 'Luis Perez Diaz', '2022', 'luis.perez@ejemplo.com', '987654323'],
  STUDENT: ['01234567', 'Maria Lopez Ruiz', 'IX', 'maria.lopez@ejemplo.com', '987654324'],
  TEACHER: ['01234567', 'Jorge Quispe Salas', 'jorge.quispe@ejemplo.com', '987654325'],
};

export class ExcelJsStakeholderImportTemplateBuilder implements StakeholderImportTemplateBuilder {
  public async build(listType: StakeholderListType): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const dataSheet = workbook.addWorksheet('Constituyentes');
    const columns = getStakeholderImportColumns(listType);

    dataSheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: 24,
      style: column.textFormat ? { numFmt: '@' } : undefined,
    }));

    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true };

    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      if (!column) {
        continue;
      }
      const excelColumn = dataSheet.getColumn(index + 1);
      if (column.textFormat) {
        excelColumn.numFmt = '@';
      }
      if (column.integerFormat) {
        const colLetter = excelColumn.letter;
        for (let rowIndex = 2; rowIndex <= STAKEHOLDER_IMPORT_MAX_ROWS + 1; rowIndex += 1) {
          dataSheet.getCell(`${colLetter}${rowIndex}`).dataValidation = {
            type: 'whole',
            operator: 'between',
            allowBlank: true,
            formulae: [STAKEHOLDER_GRADUATION_YEAR_MIN, STAKEHOLDER_GRADUATION_YEAR_MAX],
            showErrorMessage: true,
            errorTitle: 'Año de egreso inválido',
            error: `Ingresa un año entero entre ${STAKEHOLDER_GRADUATION_YEAR_MIN} y ${STAKEHOLDER_GRADUATION_YEAR_MAX}.`,
          };
        }
      }
    }

    const instructionsSheet = workbook.addWorksheet('Instrucciones');
    instructionsSheet.addRow(['Instrucciones de llenado']);
    instructionsSheet.getRow(1).font = { bold: true };
    instructionsSheet.addRow([
      `Ingresa hasta ${STAKEHOLDER_IMPORT_MAX_ROWS} filas en la hoja "Constituyentes" sin modificar los encabezados.`,
    ]);
    instructionsSheet.addRow([
      'Las columnas de DNI, RUC y Celular tienen formato de texto (@) para conservar los ceros iniciales.',
    ]);
    instructionsSheet.addRow([]);
    instructionsSheet.addRow(['Ejemplo de fila válida (no se importa desde esta hoja):']);
    instructionsSheet.addRow(columns.map((column) => column.header));
    instructionsSheet.addRow([...EXAMPLE_VALUES_BY_TYPE[listType]]);

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
