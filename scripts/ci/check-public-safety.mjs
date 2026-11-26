#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_DIRS = new Set([
  '.github',
  '.husky',
  'apps',
  'deploy',
  'manual',
  'packages',
  'scripts',
]);

export const ALLOWED_ROOT_FILES = new Set([
  '.dockerignore',
  '.editorconfig',
  '.env.example',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc',
  'CHANGELOG.md',
  'README.md',
  'SECURITY.md',
  'LICENSE',
  'commitlint.config.mjs',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'eslint.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
]);

export const ALLOWED_DOC_FILES = new Set(['docs/DEFINITION_OF_DONE.md']);

export const EXAMPLE_URL_PASSWORDS = new Set([
  'postgres',
  'secret',
  'test',
  'dummy',
  'password',
  'changeme',
  'example',
  'user',
  'pass',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.dump',
  '.bak',
  '.csv',
  '.xlsx',
  '.xls',
  '.docx',
  '.doc',
  '.zip',
  '.rar',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.rar',
  '.p12',
  '.pfx',
]);

const ALLOW_MARKER = 'public-safety:allow';

const GITHUB_CLASSIC_TOKEN_RE = /\bgh[pousr]_[A-Za-z0-9_]{36,}/g;
const GITHUB_PAT_RE = /\bgithub_pat_[A-Za-z0-9_]{20,}/g;
const RESEND_KEY_RE = /\bre_[A-Za-z0-9_]{20,}/g;
const CLOUDINARY_URL_RE = /cloudinary:\/\/([^:\s'"]+):([^@\s'"]+)@([^\s'"]+)/g;
const GENERIC_URL_CREDS_RE =
  /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^:\s/@'"]+):([^@\s/'"]+)@([^\s/'"]+)/g;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;

const PRISMA_MIGRATION_SQL_RE = /^apps\/backend\/prisma\/migrations\/.+\/migration\.sql$/;
const TEST_FIXTURES_PDF_RE = /(?:^|\/)test-fixtures\/.+\.pdf$/i;

/**
 * Normaliza separadores de ruta a formato POSIX y quita prefijos "./".
 * @param {string} filePath
 * @returns {string}
 */
export function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Enmascara un secreto mostrando solo los primeros 4 caracteres seguidos de ***.
 * @param {string} value
 * @returns {string}
 */
export function maskSecret(value) {
  const prefix = value.slice(0, 4);
  return `${prefix}***`;
}

/**
 * Determina si una contraseña en URL corresponde a un marcador o valor de ejemplo permitido.
 * @param {string} password
 * @returns {boolean}
 */
export function isAllowedExamplePassword(password) {
  const trimmed = password.trim();
  if (!trimmed) return true;
  if (EXAMPLE_URL_PASSWORDS.has(trimmed.toLowerCase())) return true;
  if (trimmed === '...' || trimmed.includes('...')) return true;
  if (/^\$\{[^}]+\}$/.test(trimmed)) return true;
  if (/^<[^>]+>$/.test(trimmed)) return true;
  return false;
}

/**
 * Parsea la variable PUBLIC_SAFETY_EXTRA_TERMS separada por comas.
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseExtraTerms(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

/**
 * Valida si una ruta cumple con la lista permitida y no corresponde a un tipo prohibido.
 * @param {string} rawPath
 * @returns {{ ok: true, path: string } | { ok: false, path: string, reason: string }}
 */
export function checkPath(rawPath) {
  const normalized = normalizePath(rawPath);
  if (!normalized) {
    return { ok: false, path: normalized, reason: 'Ruta vacía fuera de la lista permitida' };
  }

  const segments = normalized.split('/');
  const isRootFile = segments.length === 1;
  const topDir = segments[0];

  let allowedLocation = false;
  if (isRootFile) {
    allowedLocation = ALLOWED_ROOT_FILES.has(normalized);
  } else if (topDir === 'docs') {
    allowedLocation = ALLOWED_DOC_FILES.has(normalized);
  } else {
    allowedLocation = ALLOWED_DIRS.has(topDir);
  }

  if (!allowedLocation) {
    return {
      ok: false,
      path: normalized,
      reason: 'Ruta fuera de la lista permitida para el repositorio público',
    };
  }

  const baseName = path.posix.basename(normalized);
  const lowerBase = baseName.toLowerCase();
  const ext = path.posix.extname(lowerBase);

  const isEnvFile =
    lowerBase === '.env' ||
    (lowerBase.startsWith('.env.') && lowerBase !== '.env.example') ||
    (lowerBase.endsWith('.env') && !lowerBase.endsWith('.env.example'));

  if (isEnvFile) {
    return {
      ok: false,
      path: normalized,
      reason: 'Archivo de entorno (.env) prohibido; solo se permiten *.env.example',
    };
  }

  if (ext === '.sql') {
    if (!PRISMA_MIGRATION_SQL_RE.test(normalized)) {
      return {
        ok: false,
        path: normalized,
        reason: 'Archivo SQL prohibido fuera de apps/backend/prisma/migrations/**/migration.sql',
      };
    }
    return { ok: true, path: normalized };
  }

  if (ext === '.pdf') {
    if (!TEST_FIXTURES_PDF_RE.test(normalized)) {
      return {
        ok: false,
        path: normalized,
        reason: 'Archivo PDF prohibido fuera de carpetas test-fixtures',
      };
    }
    return { ok: true, path: normalized };
  }

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      path: normalized,
      reason: `Tipo de archivo prohibido (${ext})`,
    };
  }

  return { ok: true, path: normalized };
}

/**
 * Escanea una línea de texto buscando secretos o términos privados extra.
 * @param {string} line
 * @param {{ extraTerms?: string[] }} [options]
 * @returns {Array<{ type: string, preview: string | null }>}
 */
export function scanLine(line, options = {}) {
  if (!line || line.includes(ALLOW_MARKER)) {
    return [];
  }

  const findings = [];

  for (const match of line.matchAll(GITHUB_CLASSIC_TOKEN_RE)) {
    findings.push({ type: 'github-token', preview: maskSecret(match[0]) });
  }

  for (const match of line.matchAll(GITHUB_PAT_RE)) {
    findings.push({ type: 'github-fine-grained-token', preview: maskSecret(match[0]) });
  }

  for (const match of line.matchAll(RESEND_KEY_RE)) {
    findings.push({ type: 'resend-api-key', preview: maskSecret(match[0]) });
  }

  for (const match of line.matchAll(CLOUDINARY_URL_RE)) {
    const [, , apiSecret] = match;
    if (!isAllowedExamplePassword(apiSecret)) {
      findings.push({ type: 'cloudinary-url-credentials', preview: maskSecret(match[0]) });
    }
  }

  for (const match of line.matchAll(GENERIC_URL_CREDS_RE)) {
    const [fullMatch, , password] = match;
    if (fullMatch.startsWith('cloudinary://')) continue;
    if (!isAllowedExamplePassword(password)) {
      findings.push({ type: 'url-credentials', preview: maskSecret(fullMatch) });
    }
  }

  if (PRIVATE_KEY_RE.test(line)) {
    const match = PRIVATE_KEY_RE.exec(line);
    findings.push({ type: 'private-key', preview: maskSecret(match[0]) });
  }

  const extraTerms = options.extraTerms ?? [];
  if (extraTerms.length > 0) {
    const lowerLine = line.toLowerCase();
    for (const term of extraTerms) {
      if (lowerLine.includes(term.toLowerCase())) {
        findings.push({ type: 'extra-private-term', preview: null });
        break;
      }
    }
  }

  return findings;
}

/**
 * Escanea un bloque de texto completo devolviendo hallazgos con su número de línea.
 * @param {string} text
 * @param {{ file?: string, extraTerms?: string[] }} [options]
 * @returns {Array<{ file: string, line: number, type: string, preview: string | null }>}
 */
export function scanText(text, options = {}) {
  const file = options.file ? normalizePath(options.file) : '<input>';
  const extraTerms = options.extraTerms ?? [];
  const findings = [];

  if (!text || text.includes('\0')) {
    return findings;
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineFindings = scanLine(lines[i], { extraTerms });
    for (const f of lineFindings) {
      findings.push({
        file,
        line: i + 1,
        type: f.type,
        preview: f.preview,
      });
    }
  }

  return findings;
}

/**
 * Ejecuta git de forma segura sin shell intermedia.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

/**
 * Parsea la salida de git diff --unified=0 --no-color extrayendo solo líneas agregadas (+).
 * @param {string} diffOutput
 * @param {string[]} extraTerms
 * @returns {Array<{ file: string, line: number, type: string, preview: string | null }>}
 */
export function scanUnifiedDiff(diffOutput, extraTerms = []) {
  const findings = [];
  if (!diffOutput) return findings;

  const lines = diffOutput.split(/\r?\n/);
  let currentFile = '';
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = normalizePath(line.slice(6));
      continue;
    }
    if (line.startsWith('+++ /dev/null')) {
      currentFile = '';
      continue;
    }
    if (line.startsWith('@@ ')) {
      const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (hunkMatch) {
        currentLine = Number.parseInt(hunkMatch[1], 10);
      }
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++') && currentFile) {
      const addedContent = line.slice(1);
      const lineFindings = scanLine(addedContent, { extraTerms });
      for (const f of lineFindings) {
        findings.push({
          file: currentFile,
          line: currentLine,
          type: f.type,
          preview: f.preview,
        });
      }
      currentLine += 1;
    }
  }

  return findings;
}

/**
 * Ejecuta la verificación completa según el modo indicado.
 * @param {{ mode: 'all' | 'staged' | 'range', base?: string, cwd?: string, extraTerms?: string[] }} options
 */
export function runPublicSafetyCheck(options) {
  const cwd = options.cwd ?? process.cwd();
  const extraTerms =
    options.extraTerms ?? parseExtraTerms(process.env.PUBLIC_SAFETY_EXTRA_TERMS);

  let files = [];
  let secretFindings = [];

  if (options.mode === 'staged') {
    const rawFiles = runGit(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
      cwd,
    );
    files = rawFiles.split('\0').filter(Boolean).map(normalizePath);
    const diff = runGit(
      ['diff', '--cached', '--unified=0', '--no-color', '--diff-filter=ACMR'],
      cwd,
    );
    secretFindings = scanUnifiedDiff(diff, extraTerms);
  } else if (options.mode === 'range') {
    if (!options.base) {
      throw new Error('Se requiere una referencia base para --range <base>.');
    }
    const rangeSpec = `${options.base}...HEAD`;
    const rawFiles = runGit(['diff', '--name-only', '--diff-filter=ACMR', '-z', rangeSpec], cwd);
    files = rawFiles.split('\0').filter(Boolean).map(normalizePath);
    const diff = runGit(
      ['diff', '--unified=0', '--no-color', '--diff-filter=ACMR', rangeSpec],
      cwd,
    );
    secretFindings = scanUnifiedDiff(diff, extraTerms);
  } else {
    const rawFiles = runGit(['ls-files', '-z'], cwd);
    files = rawFiles.split('\0').filter(Boolean).map(normalizePath);
    for (const relPath of files) {
      const ext = path.posix.extname(relPath.toLowerCase());
      if (BINARY_EXTENSIONS.has(ext)) continue;
      const fullPath = path.join(cwd, relPath);
      if (!fs.existsSync(fullPath)) continue;
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      secretFindings.push(...scanText(content, { file: relPath, extraTerms }));
    }
  }

  const pathViolations = [];
  for (const file of files) {
    const result = checkPath(file);
    if (!result.ok) {
      pathViolations.push({ file: result.path, reason: result.reason });
    }
  }

  return {
    checkedFiles: files.length,
    pathViolations,
    secretFindings,
    ok: pathViolations.length === 0 && secretFindings.length === 0,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--staged')) {
    return { mode: 'staged' };
  }
  const rangeIdx = args.indexOf('--range');
  if (rangeIdx !== -1) {
    const base = args[rangeIdx + 1];
    if (!base || base.startsWith('--')) {
      throw new Error('Uso: check-public-safety.mjs --range <base>');
    }
    return { mode: 'range', base };
  }
  return { mode: 'all' };
}

function main() {
  try {
    const parsed = parseArgs(process.argv);
    const result = runPublicSafetyCheck(parsed);

    if (result.ok) {
      console.log(
        `[public-safety] OK: ${result.checkedFiles} archivo(s) verificado(s) en modo ${parsed.mode}.`,
      );
      process.exit(0);
    }

    console.error('[public-safety] Se detectaron violaciones de seguridad de publicación:');
    for (const v of result.pathViolations) {
      console.error(`  - [ruta] ${v.file}: ${v.reason}`);
    }
    for (const s of result.secretFindings) {
      const previewPart = s.preview ? ` (${s.preview})` : '';
      console.error(`  - [secreto] ${s.file}:${s.line} [${s.type}]${previewPart}`);
    }
    process.exit(1);
  } catch (error) {
    console.error(`[public-safety] Error: ${error.message}`);
    process.exit(1);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? '') === currentFile) {
  main();
}
