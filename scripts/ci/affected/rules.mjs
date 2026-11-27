import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPosixPath } from './graph.mjs';

const DEFAULT_RULES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rules.json');
const globRegexCache = new Map();

/**
 * Carga las reglas de selección desde JSON.
 * @param {string} [rulesPath]
 */
export function loadRules(rulesPath = DEFAULT_RULES_PATH) {
  const raw = fs.readFileSync(rulesPath, 'utf8');
  return JSON.parse(raw);
}

function compileGlob(pattern) {
  const normalized = toPosixPath(pattern);
  if (globRegexCache.has(normalized)) {
    return globRegexCache.get(normalized);
  }

  let regexStr = '^';
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        if (normalized[i + 2] === '/') {
          regexStr += '(?:.+/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        regexStr += '[^/]*';
        i += 1;
      }
    } else if (ch === '?') {
      regexStr += '[^/]';
      i += 1;
    } else if (ch === '{') {
      const closeIdx = normalized.indexOf('}', i);
      if (closeIdx !== -1) {
        const alternatives = normalized
          .slice(i + 1, closeIdx)
          .split(',')
          .map((alt) => alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        regexStr += `(?:${alternatives.join('|')})`;
        i = closeIdx + 1;
      } else {
        regexStr += '\\{';
        i += 1;
      }
    } else {
      regexStr += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  regexStr += '$';
  const regex = new RegExp(regexStr);
  globRegexCache.set(normalized, regex);
  return regex;
}

/**
 * Comprueba si `filePath` coincide con un patrón glob POSIX.
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
export function matchesGlob(filePath, pattern) {
  const rel = toPosixPath(filePath);
  return compileGlob(pattern).test(rel);
}

/**
 * Comprueba si `filePath` coincide con alguno de los patrones de la lista.
 * @param {string} filePath
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function matchesAnyGlob(filePath, patterns = []) {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

/**
 * Clasifica un archivo de prueba en su categoría o devuelve `null` si no es prueba.
 * @param {string} filePath
 * @param {ReturnType<typeof loadRules>} rules
 * @returns {'backendUnit' | 'backendIntegration' | 'frontend' | 'shared' | 'e2e' | null}
 */
export function classifyTestFile(filePath, rules) {
  const rel = toPosixPath(filePath);
  const tp = rules.testPatterns ?? {};
  if (matchesAnyGlob(rel, tp.backendIntegration)) return 'backendIntegration';
  if (matchesAnyGlob(rel, tp.backendUnit)) return 'backendUnit';
  if (matchesAnyGlob(rel, tp.frontend)) return 'frontend';
  if (matchesAnyGlob(rel, tp.shared)) return 'shared';
  if (matchesAnyGlob(rel, tp.e2e)) return 'e2e';
  return null;
}

/**
 * Indica si el archivo es una raíz de composición que corta la propagación transitiva.
 */
export function isCompositionRoot(filePath, rules) {
  const rel = toPosixPath(filePath);
  return (rules.compositionRoots ?? []).includes(rel);
}

/**
 * Indica si el archivo dispara ejecución global.
 */
export function isGlobalTrigger(filePath, rules) {
  return matchesAnyGlob(filePath, rules.globalTriggers ?? []);
}

/**
 * Indica si el archivo es inerte (documentación, imágenes, etc.).
 */
export function isInertFile(filePath, rules) {
  return matchesAnyGlob(filePath, rules.inertPatterns ?? []);
}

/**
 * Indica si el archivo pertenece a un área conocida de código o scripts.
 */
export function isKnownCodeFile(filePath, rules) {
  return matchesAnyGlob(filePath, rules.knownCodePatterns ?? []);
}

/**
 * Devuelve las pruebas relacionadas por afinidad de módulo cuando cambia `apps/backend/src/modules/<m>/**`.
 * @param {string} filePath
 * @param {Iterable<string>} allNodes
 * @param {ReturnType<typeof loadRules>} rules
 * @returns {string[]}
 */
export function getModuleAffinityMatches(filePath, allNodes, rules) {
  const rel = toPosixPath(filePath);
  const prefix = rules.moduleAffinity?.modulePrefix ?? 'apps/backend/src/modules/';
  if (!rel.startsWith(prefix)) return [];

  const rest = rel.slice(prefix.length);
  const moduleName = rest.split('/')[0];
  if (!moduleName) return [];

  const moduleDir = `${prefix}${moduleName}/`;
  const rootPrefix = rules.moduleAffinity?.rootIntegrationPrefix ?? 'apps/backend/src/';
  const matches = [];

  for (const node of allNodes) {
    const category = classifyTestFile(node, rules);
    if (category !== 'backendUnit' && category !== 'backendIntegration') continue;

    if (node.startsWith(moduleDir)) {
      matches.push(node);
      continue;
    }

    if (category === 'backendIntegration' && node.startsWith(rootPrefix)) {
      const baseName = path.posix.basename(node);
      if (baseName.startsWith(`${moduleName}.`) || baseName.startsWith(`${moduleName}-`)) {
        matches.push(node);
      }
    }
  }

  return matches.sort();
}

/**
 * Indica si el archivo activa una ejecución completa de E2E según `e2eFullTriggers`.
 * Las pruebas unitarias de frontend (`*.test.*`, `*.spec.*`) no activan E2E por sí mismas.
 */
export function matchesE2eFullTrigger(filePath, rules) {
  const rel = toPosixPath(filePath);
  const category = classifyTestFile(rel, rules);
  if (category === 'frontend' || category === 'backendUnit' || category === 'backendIntegration' || category === 'shared') {
    return false;
  }
  return matchesAnyGlob(rel, rules.e2eFullTriggers ?? []);
}
