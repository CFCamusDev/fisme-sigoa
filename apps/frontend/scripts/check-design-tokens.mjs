#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_TAILWIND_CLASS_REGEX =
  /(?:[a-z0-9-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow|placeholder)-(?:slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?(?![a-zA-Z0-9_-])/g;

const ARBITRARY_COLOR_REGEX =
  /(?:[a-z0-9-]+:)*(?:bg|text|border|ring|outline|fill|stroke)-(?:\[#(?:[0-9a-fA-F]{3,8})\]|\[(?:rgb|rgba|hsl|hsla|oklch)\([^\]]+\)\])/g;

const DARK_VARIANT_REGEX = /(?:^|[^a-zA-Z0-9_-])(dark:[a-zA-Z0-9_/-]+)/g;

const HEX_COLOR_REGEX =
  /(?<![a-zA-Z0-9_/-])#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/g;

/**
 * Analiza un string fuente y devuelve una lista de violaciones al sistema de diseño.
 */
export function findViolations(source, filePath) {
  const violations = [];
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;

    // Verificar escape controlado: // design-tokens:allow <motivo obligatorio>
    const allowIndex = rawLine.indexOf('design-tokens:allow');
    if (allowIndex !== -1) {
      const commentRest = rawLine.slice(allowIndex + 'design-tokens:allow'.length).trim();
      if (commentRest.length > 0) {
        // Motivo proporcionado: se omite la línea
        continue;
      }
      // Sin motivo: se reporta violación sobre el escape incompleto
      violations.push({
        file: filePath,
        line: lineNumber,
        column: allowIndex + 1,
        message: 'El comentario de escape "design-tokens:allow" requiere un motivo obligatorio.',
        match: 'design-tokens:allow',
      });
    }

    // Para evitar falsos positivos con comentarios explicativos, analizamos solo código
    let codePart = rawLine;
    const lineCommentIndex = rawLine.indexOf('//');
    if (lineCommentIndex !== -1) {
      codePart = rawLine.slice(0, lineCommentIndex);
    }

    // 1. Clases prohibidas de la paleta estándar de Tailwind
    let match;
    FORBIDDEN_TAILWIND_CLASS_REGEX.lastIndex = 0;
    while ((match = FORBIDDEN_TAILWIND_CLASS_REGEX.exec(codePart)) !== null) {
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        message: `Uso prohibido de clase de paleta estándar "${match[0]}". Usa tokens de diseño institucional (ej. bg-primary, text-muted-foreground).`,
        match: match[0],
      });
    }

    // 2. Colores arbitrarios [ #... ] o [ rgb(...) ]
    ARBITRARY_COLOR_REGEX.lastIndex = 0;
    while ((match = ARBITRARY_COLOR_REGEX.exec(codePart)) !== null) {
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        message: `Uso prohibido de valor de color arbitrario "${match[0]}". Usa exclusivamente tokens semánticos definidos en index.css.`,
        match: match[0],
      });
    }

    // 3. Prefijo dark:
    DARK_VARIANT_REGEX.lastIndex = 0;
    while ((match = DARK_VARIANT_REGEX.exec(codePart)) !== null) {
      const darkMatch = match[1];
      const col = match.index + match[0].indexOf(darkMatch) + 1;
      violations.push({
        file: filePath,
        line: lineNumber,
        column: col,
        message: `Uso prohibido de variante "${darkMatch}". El sistema institucional opera exclusivamente en modo claro.`,
        match: darkMatch,
      });
    }

    // 4. Hexadecimales fuera de comentarios
    HEX_COLOR_REGEX.lastIndex = 0;
    while ((match = HEX_COLOR_REGEX.exec(codePart)) !== null) {
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        message: `Uso de color hexadecimal literal "${match[0]}". Usa tokens de diseño institucional en index.css o añade "// design-tokens:allow <motivo>" si es obligatorio.`,
        match: match[0],
      });
    }
  }

  return violations;
}

const EXCLUDE_FILE_PATTERNS = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /[/\\]src[/\\]test[/\\]/,
  /routeTree\.gen\.ts$/,
  /\.d\.ts$/,
  /[/\\]src[/\\]assets[/\\]/,
  /[/\\]src[/\\]index\.css$/,
];

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html', '.css']);

function isExcluded(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return EXCLUDE_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Escanea recursivamente un directorio e identifica violaciones.
 */
export function scanDirectory(dir) {
  const violations = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ALLOWED_EXTENSIONS.has(ext) && !isExcluded(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const fileViolations = findViolations(content, fullPath);
          violations.push(...fileViolations);
        }
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir);
  }

  return violations;
}

// Ejecución como CLI
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const targetDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(path.dirname(__filename), '../src');

  const violations = scanDirectory(targetDir);

  if (violations.length > 0) {
    console.error(`\n❌ Se encontraron ${violations.length} violación(es) al sistema de diseño institucional:\n`);
    for (const v of violations) {
      console.error(`${v.file}:${v.line}:${v.column} — ${v.message}`);
    }
    console.error(
      '\nPara excepciones justificadas (ej. librerías de gráficos), usa "// design-tokens:allow <motivo>".\n',
    );
    process.exit(1);
  } else {
    console.log('✅ Guarda check-design-tokens: 0 violaciones detectadas en el código fuente.');
    process.exit(0);
  }
}
