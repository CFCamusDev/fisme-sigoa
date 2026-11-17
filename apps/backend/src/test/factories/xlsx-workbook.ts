import ExcelJS from 'exceljs';

export async function buildWorkbookBuffer(
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
