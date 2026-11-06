#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MONITORED_FUNCTIONS = ['dirname', 'join', 'resolve', 'normalize', 'basename'];

export const DEFAULT_EXCLUSIONS = [
  {
    file: 'apps/backend/src/architecture/verify-pr-local.test.ts',
    reason: 'Usa funciones path del anfitrión para ubicar archivos reales del repositorio local.',
  },
  {
    file: 'apps/backend/src/architecture/check-windows-paths.test.ts',
    reason: 'Contiene muestras de código y fragmentos sintéticos de prueba.',
  },
];

// Literal con unidad de disco ('C:\\...' o "C:\\...") o la palabra win32.
// win32 se concatena dinámicamente para evitar que este propio analizador se auto-incluya en falso positivo.
const WIN32_WORD = ['win', '32'].join('');
const SCOPE_REGEX = new RegExp(`\\b${WIN32_WORD}\\b|['"\`][A-Za-z]:\\\\\\\\`);
const MONITORED_FNS_PATTERN = MONITORED_FUNCTIONS.join('|');
const PATH_CALL_REGEX = new RegExp(`(?<!\\b(?:win32|posix)\\.)\\bpath\\.(${MONITORED_FNS_PATTERN})\\s*\\(`, 'g');
const NAMED_IMPORT_REGEX = new RegExp(
  `import\\s+[^'"]*\\{[^}]*\\b(${MONITORED_FNS_PATTERN})\\b[^}]*\\}\\s+from\\s+['"](?:node:)?path['"]`,
);

/**
 * Valida la lista de exclusiones para asegurar que cada una tenga justificación explícita.
 */
function validateExclusions(exclusions) {
  for (const exc of exclusions) {
    if (!exc || typeof exc.reason !== 'string' || exc.reason.trim().length === 0) {
      throw new Error(`Exclusion for "${exc?.file ?? 'unknown'}" must include a non-empty reason.`);
    }
  }
}

/**
 * Normaliza las rutas con separador POSIX (/).
 */
export function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Analiza una lista de archivos en memoria y encuentra violaciones de uso de path.
 * @param {Array<{ path: string, content: string }>} files
 * @param {Array<{ file: string, reason: string }>} exclusions
 */
export function findWindowsPathViolations(files, exclusions = DEFAULT_EXCLUSIONS) {
  validateExclusions(exclusions);

  const excludedFileSet = new Set(exclusions.map((e) => normalizePath(e.file)));
  const violations = [];

  for (const file of files) {
    const normalizedFilePath = normalizePath(file.path);
    if (excludedFileSet.has(normalizedFilePath)) {
      continue;
    }

    const content = file.content;
    if (!SCOPE_REGEX.test(content)) {
      // El archivo no está en alcance (no contiene win32 ni unidad de disco)
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const lineNum = index + 1;
      const lineText = lines[index];

      // 1. Detección de importaciones nombradas desde node:path
      const importMatch = NAMED_IMPORT_REGEX.exec(lineText);
      if (importMatch) {
        // Encontrar todas las funciones monitoreadas importadas en esta línea
        for (const fn of MONITORED_FUNCTIONS) {
          const fnImportRegex = new RegExp(`\\b${fn}\\b`);
          if (lineText.includes(`import`) && fnImportRegex.test(lineText)) {
            violations.push({
              file: normalizedFilePath,
              line: lineNum,
              functionName: fn,
              suggestion: `path.win32.${fn}`,
              message: `Importación nombrada "${fn}" desde node:path en archivo con rutas de Windows. Usa "path.win32.${fn}" para garantizar portabilidad en CI Linux.`,
            });
          }
        }
        continue;
      }

      // 2. Detección de llamadas directas path.<fn>(
      let callMatch;
      PATH_CALL_REGEX.lastIndex = 0;
      while ((callMatch = PATH_CALL_REGEX.exec(lineText)) !== null) {
        const fn = callMatch[1];
        violations.push({
          file: normalizedFilePath,
          line: lineNum,
          functionName: fn,
          suggestion: `path.win32.${fn}`,
          message: `Llamada a "path.${fn}" en archivo con rutas de Windows. Usa "path.win32.${fn}" para evitar fallos en CI Linux (AGENTS §9).`,
        });
      }
    }
  }

  return violations;
}

/**
 * Recorre recursivamente un directorio buscando extensiones permitidas, omitiendo carpetas ignoradas.
 */
function walkDir(dir, allowedExtensions, results = []) {
  const posixDir = normalizePath(dir);
  if (!fs.existsSync(posixDir)) return results;
  const entries = fs.readdirSync(posixDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.posix.join(posixDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'generated' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.cache' ||
        entry.name === 'tmp'
      ) {
        continue;
      }
      walkDir(fullPath, allowedExtensions, results);
    } else if (entry.isFile()) {
      const ext = path.posix.extname(entry.name);
      if (allowedExtensions.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Escanea los archivos de scripts/ y apps/*\/src/ del repositorio.
 * @param {string} repoRoot
 */
export function scanRepositoryFiles(repoRoot) {
  const normalizedRoot = normalizePath(repoRoot);
  const scriptsDir = path.posix.join(normalizedRoot, 'scripts');
  const appsDir = path.posix.join(normalizedRoot, 'apps');

  const scriptFiles = walkDir(scriptsDir, new Set(['.mjs', '.js', '.ts']));
  
  const srcFiles = [];
  if (fs.existsSync(appsDir)) {
    const appEntries = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const app of appEntries) {
      if (app.isDirectory()) {
        const srcDir = path.posix.join(appsDir, app.name, 'src');
        if (fs.existsSync(srcDir)) {
          walkDir(srcDir, new Set(['.ts', '.tsx']), srcFiles);
        }
      }
    }
  }

  const allFilePaths = [...scriptFiles, ...srcFiles];
  return allFilePaths.map((absPath) => {
    const relPath = path.posix.relative(normalizedRoot, absPath);
    return {
      path: normalizePath(relPath),
      content: fs.readFileSync(absPath, 'utf-8'),
    };
  });
}

/**
 * CLI runner
 */
export async function runCli() {
  const repoRoot = process.cwd();
  const files = scanRepositoryFiles(repoRoot);
  const violations = findWindowsPathViolations(files, DEFAULT_EXCLUSIONS);

  if (violations.length > 0) {
    console.error(`ERROR: Se encontraron ${violations.length} violaciones de rutas Windows (AGENTS §9):`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} -> ${v.message} (Sugerencia: ${v.suggestion})`);
    }
    process.exit(1);
  }

  console.log('OK: sin violaciones de rutas Windows en scripts y pruebas.');
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('check-windows-paths.mjs') ||
    (process.argv[1].includes('check-windows-paths') && !process.argv[1].includes('vitest')));

if (isDirectRun) {
  runCli().catch((err) => {
    console.error('ERROR inesperado al verificar rutas Windows:', err);
    process.exit(1);
  });
}
