const SHARED_PREFIX = 'packages/shared/src/';
export const SHARED_BARREL = 'packages/shared/src/index.ts';

function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx|mts|js|jsx|mjs)$/.test(filePath);
}

/**
 * Construye el mapa `símbolo -> Set<archivoDefinidor>` siguiendo el barril `packages/shared/src/index.ts`.
 * @param {ReturnType<import('./graph.mjs').buildGraph>} graph
 * @returns {{ symbolToFiles: Map<string, Set<string>>, barrelFiles: Set<string> }}
 */
export function buildSharedSymbolMap(graph) {
  const barrelFiles = new Set();
  const memo = new Map();

  function addSymbol(targetMap, symbol, definingFiles) {
    if (!targetMap.has(symbol)) {
      targetMap.set(symbol, new Set());
    }
    const set = targetMap.get(symbol);
    for (const f of definingFiles) {
      set.add(f);
    }
  }

  function resolveFileExports(file, stack = new Set()) {
    if (memo.has(file)) return memo.get(file);
    if (stack.has(file)) return new Map();

    stack.add(file);
    const result = new Map();
    const info = graph.exports?.get(file);

    if (file.startsWith(SHARED_PREFIX) && !isTestFile(file)) {
      barrelFiles.add(file);
    }

    if (info) {
      for (const localName of info.localExports ?? []) {
        addSymbol(result, localName, [file]);
      }

      for (const re of info.reexports ?? []) {
        if (!re.target) continue;
        const targetExports = resolveFileExports(re.target, stack);

        if (re.star) {
          for (const [sym, defs] of targetExports.entries()) {
            if (sym === 'default') continue;
            addSymbol(result, sym, defs);
          }
        } else {
          for (const item of re.names ?? []) {
            const defs = targetExports.get(item.imported);
            if (defs && defs.size > 0) {
              addSymbol(result, item.exported, defs);
            } else {
              addSymbol(result, item.exported, [re.target]);
            }
          }
        }
      }
    }

    stack.delete(file);
    memo.set(file, result);
    return result;
  }

  for (const node of graph.nodes) {
    if (node.startsWith(SHARED_PREFIX) && !isTestFile(node)) {
      resolveFileExports(node);
    }
  }

  const symbolToFiles = graph.nodes.has(SHARED_BARREL)
    ? resolveFileExports(SHARED_BARREL)
    : new Map();

  return { symbolToFiles, barrelFiles };
}

/**
 * Reemplaza las aristas `archivo -> packages/shared/src/index.ts` por aristas hacia los archivos
 * que definen los símbolos importados. Ante `import *`, `default` o símbolo desconocido, enlaza
 * de forma conservadora con todos los archivos del barril.
 * @param {ReturnType<import('./graph.mjs').buildGraph>} graph
 */
export function refineSharedEdges(graph) {
  const { symbolToFiles, barrelFiles } = buildSharedSymbolMap(graph);
  if (!graph.nodes.has(SHARED_BARREL) || barrelFiles.size === 0) {
    return graph;
  }

  for (const [file, fileImports] of graph.imports?.entries() ?? []) {
    if (file.startsWith(SHARED_PREFIX)) continue;

    const barrelImports = fileImports.filter((imp) => imp.target === SHARED_BARREL);
    if (barrelImports.length === 0) continue;

    const resolvedTargets = new Set();
    let conservative = false;

    for (const imp of barrelImports) {
      if (imp.namespaceImport || imp.defaultImport || !imp.named || imp.named.length === 0) {
        conservative = true;
        break;
      }
      for (const symbol of imp.named) {
        const defs = symbolToFiles.get(symbol);
        if (!defs || defs.size === 0) {
          conservative = true;
          break;
        }
        for (const defFile of defs) {
          resolvedTargets.add(defFile);
        }
      }
      if (conservative) break;
    }

    if (conservative) {
      for (const bf of barrelFiles) {
        resolvedTargets.add(bf);
      }
    }

    const fileEdges = graph.edges.get(file);
    if (!fileEdges) continue;

    fileEdges.delete(SHARED_BARREL);
    graph.reverse.get(SHARED_BARREL)?.delete(file);

    for (const target of resolvedTargets) {
      fileEdges.add(target);
      if (!graph.reverse.has(target)) {
        graph.reverse.set(target, new Set());
      }
      graph.reverse.get(target).add(file);
    }
  }

  return graph;
}
