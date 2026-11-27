#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, toPosixPath } from './graph.mjs';
import {
  classifyTestFile,
  getModuleAffinityMatches,
  isCompositionRoot,
  isGlobalTrigger,
  isInertFile,
  isKnownCodeFile,
  loadRules,
} from './rules.mjs';
import { refineSharedEdges } from './symbols.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Interpreta los argumentos del CLI de `select.mjs`.
 * @param {string[]} argv
 * @returns {{ base: string, explain: boolean, json: boolean }}
 */
export function parseArgs(argv) {
  const result = { base: 'develop', explain: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--base requiere una rama o commit.');
      result.base = value;
      i += 1;
    } else if (arg === '--explain') {
      result.explain = true;
    } else if (arg === '--json') {
      result.json = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return result;
}

/**
 * Recolecta los archivos cambiados desde `base` (incluye no confirmados y sin seguimiento).
 * Devuelve `null` si no se puede calcular el diff (por ejemplo, base inexistente).
 * @param {string} base
 * @param {string} [root]
 * @returns {string[] | null}
 */
export function collectChangedFiles(base = 'develop', root = repoRoot) {
  try {
    const changed = execFileSync(
      'git',
      ['-c', 'core.quotepath=false', 'diff', '--name-only', '--diff-filter=d', base],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
      .split(/\r?\n/)
      .filter(Boolean);

    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split(/\r?\n/)
      .filter(Boolean);

    return Array.from(new Set([...changed, ...untracked].map((f) => toPosixPath(f)).filter(Boolean)));
  } catch {
    return null;
  }
}

function collectAllTests(graph, rules) {
  const all = {
    backendUnit: [],
    backendIntegration: [],
    frontend: [],
    shared: [],
  };
  for (const node of graph.nodes) {
    const cat = classifyTestFile(node, rules);
    if (cat && cat !== 'e2e') {
      all[cat].push(node);
    }
  }
  all.backendUnit.sort();
  all.backendIntegration.sort();
  all.frontend.sort();
  all.shared.sort();
  return all;
}

function buildTotals(selection, allTests) {
  return {
    backendUnit: { selected: selection.backendUnit.length, total: allTests.backendUnit.length },
    backendIntegration: {
      selected: selection.backendIntegration.length,
      total: allTests.backendIntegration.length,
    },
    frontend: { selected: selection.frontend.length, total: allTests.frontend.length },
    shared: { selected: selection.shared.length, total: allTests.shared.length },
  };
}

function isStaticCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
}

/**
 * Calcula la selección de pruebas afectadas a partir de `changedFiles`, el grafo y las reglas.
 * @param {{ changedFiles: string[] | null, graph: ReturnType<typeof buildGraph>, rules?: ReturnType<typeof loadRules> }} params
 */
export function selectAffected({ changedFiles, graph, rules = loadRules() }) {
  const allTests = collectAllTests(graph, rules);

  if (changedFiles === null || changedFiles === undefined) {
    const selection = {
      ...allTests,
      e2e: { scope: 'full', reason: 'Modo completo: no se pudo calcular el diff respecto a la base' },
      staticFiles: [],
    };
    return {
      mode: 'all',
      reason: 'No se pudo calcular el diff respecto a la base',
      selection,
      totals: buildTotals(selection, allTests),
      explain: [
        {
          target: '*',
          reason: 'No se pudo calcular el diff respecto a la base',
          via: null,
        },
      ],
    };
  }

  const normalizedChanged = Array.from(
    new Set(changedFiles.map((f) => toPosixPath(f)).filter(Boolean)),
  ).sort();

  if (normalizedChanged.length === 0) {
    const selection = {
      backendUnit: [],
      backendIntegration: [],
      frontend: [],
      shared: [],
      e2e: { scope: 'none', reason: 'No hay archivos cambiados' },
      staticFiles: [],
    };
    return {
      mode: 'affected',
      reason: 'No hay archivos cambiados',
      selection,
      totals: buildTotals(selection, allTests),
      explain: [],
    };
  }

  for (const file of normalizedChanged) {
    if (isGlobalTrigger(file, rules)) {
      const reason = `Disparador global modificado: ${file}`;
      const selection = {
        ...allTests,
        e2e: { scope: 'full', reason },
        staticFiles: normalizedChanged.filter(isStaticCodeFile),
      };
      return {
        mode: 'all',
        reason,
        selection,
        totals: buildTotals(selection, allTests),
        explain: [{ target: '*', reason, via: file }],
      };
    }

    const testCat = classifyTestFile(file, rules);
    if (!isInertFile(file, rules) && !testCat && !graph.nodes.has(file) && !isKnownCodeFile(file, rules)) {
      const reason = `Archivo desconocido fuera de las reglas: ${file}`;
      const selection = {
        ...allTests,
        e2e: { scope: 'full', reason },
        staticFiles: normalizedChanged.filter(isStaticCodeFile),
      };
      return {
        mode: 'all',
        reason,
        selection,
        totals: buildTotals(selection, allTests),
        explain: [{ target: '*', reason, via: file }],
      };
    }
  }

  const selectedSets = {
    backendUnit: new Set(),
    backendIntegration: new Set(),
    frontend: new Set(),
    shared: new Set(),
  };
  const explainMap = new Map();
  const staticFiles = new Set();

  function addSelectedTest(testFile, category, reason, via) {
    if (!selectedSets[category]) return;
    selectedSets[category].add(testFile);
    if (!explainMap.has(testFile)) {
      explainMap.set(testFile, { target: testFile, category, reason, via });
    }
  }

  for (const file of normalizedChanged) {
    if (isInertFile(file, rules)) {
      continue;
    }

    if (isStaticCodeFile(file)) {
      staticFiles.add(file);
    }

    const directCategory = classifyTestFile(file, rules);
    if (directCategory && directCategory !== 'e2e') {
      addSelectedTest(file, directCategory, 'prueba modificada directamente', file);
      continue;
    }

    const queue = [{ node: file, via: file, depth: 0 }];
    const visited = new Set([file]);

    while (queue.length > 0) {
      const { node, depth } = queue.shift();
      const dependents = graph.reverse.get(node);
      if (!dependents) continue;

      for (const dep of dependents) {
        const depCat = classifyTestFile(dep, rules);
        if (depCat && depCat !== 'e2e') {
          addSelectedTest(dep, depCat, `importa ${node} (cambio en ${file})`, file);
        }

        if (!visited.has(dep)) {
          visited.add(dep);
          // Si `dep` es una raíz de composición como nodo intermedio, corta la propagación (D3).
          if (!isCompositionRoot(dep, rules)) {
            queue.push({ node: dep, via: node, depth: depth + 1 });
          }
        }
      }
    }

    for (const affinityTest of getModuleAffinityMatches(file, graph.nodes, rules)) {
      const cat = classifyTestFile(affinityTest, rules);
      if (cat && cat !== 'e2e') {
        addSelectedTest(affinityTest, cat, `afinidad de módulo con ${file}`, file);
      }
    }
  }

  const selection = {
    backendUnit: Array.from(selectedSets.backendUnit).sort(),
    backendIntegration: Array.from(selectedSets.backendIntegration).sort(),
    frontend: Array.from(selectedSets.frontend).sort(),
    shared: Array.from(selectedSets.shared).sort(),
    e2e: { scope: 'none', reason: 'Pendiente de evaluar alcance E2E' },
    staticFiles: Array.from(staticFiles).sort(),
  };

  return {
    mode: 'affected',
    reason: `Selección calculada para ${normalizedChanged.length} archivo(s) cambiado(s)`,
    selection,
    totals: buildTotals(selection, allTests),
    explain: Array.from(explainMap.values()).sort((a, b) => a.target.localeCompare(b.target)),
  };
}

/**
 * Construye el grafo del repositorio, refina `@sigoa/shared` y calcula la selección.
 * @param {{ base?: string, root?: string, changedFiles?: string[] | null }} [options]
 */
export function runSelection(options = {}) {
  const root = options.root ?? repoRoot;
  const rules = loadRules();
  const graph = buildGraph({ root });
  refineSharedEdges(graph);
  const changedFiles =
    options.changedFiles !== undefined
      ? options.changedFiles
      : collectChangedFiles(options.base ?? 'develop', root);

  return selectAffected({ changedFiles, graph, rules });
}

function formatHumanReport(result, explain) {
  const lines = [];
  lines.push(`Modo: ${result.mode} · Motivo: ${result.reason}`);
  lines.push(
    `Backend unit: ${result.totals.backendUnit.selected}/${result.totals.backendUnit.total} · ` +
      `Backend integration: ${result.totals.backendIntegration.selected}/${result.totals.backendIntegration.total} · ` +
      `Frontend: ${result.totals.frontend.selected}/${result.totals.frontend.total} · ` +
      `Shared: ${result.totals.shared.selected}/${result.totals.shared.total}`,
  );
  lines.push(`E2E: ${result.selection.e2e.scope} (${result.selection.e2e.reason})`);

  if (explain && result.explain.length > 0) {
    lines.push('\nDetalle (--explain):');
    for (const item of result.explain) {
      lines.push(`  - ${item.target}: ${item.reason}`);
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = runSelection({ base: args.base });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHumanReport(result, args.explain));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
