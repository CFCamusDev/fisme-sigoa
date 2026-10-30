/**
 * Helper para inspección tipográfica en documentos PDF generados (HU-077, T-077-13).
 * Extrae los nombres de las fuentes embebidas o referenciadas desde los diccionarios del PDF,
 * removiendo el prefijo estándar de subconjunto de 6 letras (ej. ABCDEF+OpenSans -> OpenSans).
 */
export function extractPdfFontNames(pdf: Buffer): string[] {
  const text = pdf.toString('latin1');
  const fontNames = new Set<string>();

  const fontRegex = /\/(?:BaseFont|FontName)\s*\/([^\s/>]+)/g;
  let match: RegExpExecArray | null;

  while ((match = fontRegex.exec(text)) !== null) {
    let rawName = match[1] ?? '';
    // Decodificar escapes hexadecimales en literales PDF (#20 para espacio, etc.)
    rawName = rawName.replace(/#([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    // Remover prefijo estándar de subconjunto tipográfico (6 letras mayúsculas seguidas de '+')
    const cleanName = rawName.replace(/^[A-Z]{6}\+/, '');
    if (cleanName.length > 0) {
      fontNames.add(cleanName);
    }
  }

  return Array.from(fontNames);
}
