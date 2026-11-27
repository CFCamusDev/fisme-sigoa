import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage', 'test-results', '.git', '.turbo', 'tmp']);
const SCAN_ROOTS = [
  'apps/backend/src',
  'apps/frontend/src',
  'apps/frontend/e2e',
  'packages/shared/src',
  'scripts',
];
const VI_MODULE_METHODS = new Set(['mock', 'doMock', 'importActual', 'importMock']);

/**
 * Normaliza una ruta con separadores POSIX `/` usando `path.win32` cuando hay barras invertidas.
 * @param {string} value
 * @returns {string}
 */
export function toPosixPath(value) {
  if (!value) return '';
  const normalized = value.includes('\\') ? path.win32.normalize(value).replace(/\\/g, '/') : path.posix.normalize(value);
  return normalized.replace(/^\.\//, '').replace(/\/$/, '');
}

/**
 * Convierte una ruta absoluta o relativa a ruta relativa respecto a `root` con separador `/`.
 * @param {string} root
 * @param {string} filePath
 * @returns {string}
 */
export function toRelativePosix(root, filePath) {
  const rootPosix = toPosixPath(root);
  const filePosix = toPosixPath(filePath);
  if (rootPosix && filePosix.startsWith(`${rootPosix}/`)) {
    return filePosix.slice(rootPosix.length + 1);
  }
  return filePosix.replace(/^\/+/, '');
}

function getScriptKind(filePath) {
  const ext = path.posix.extname(filePath).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Crea un host de sistema de archivos normalizado sobre rutas relativas POSIX.
 * @param {string} root
 * @param {{ readFile?: (p: string) => string | undefined, fileExists?: (p: string) => boolean }} [customHost]
 */
function createNormalizedHost(root, customHost) {
  const rootPosix = toPosixPath(root);

  const resolveInputPath = (p) => {
    const posix = toPosixPath(p);
    if (posix.startsWith(`${rootPosix}/`)) return posix;
    if (path.posix.isAbsolute(posix) || /^[a-zA-Z]:\//.test(posix)) return posix;
    return `${rootPosix}/${posix}`;
  };

  if (customHost) {
    return {
      isVirtual: true,
      fileExists(p) {
        const rel = toRelativePosix(rootPosix, p);
        return Boolean(customHost.fileExists?.(rel) || customHost.fileExists?.(resolveInputPath(rel)));
      },
      readFile(p) {
        const rel = toRelativePosix(rootPosix, p);
        const content = customHost.readFile?.(rel);
        if (content !== undefined) return content;
        return customHost.readFile?.(resolveInputPath(rel));
      },
    };
  }

  return {
    isVirtual: false,
    fileExists(p) {
      const abs = path.resolve(root, toRelativePosix(rootPosix, p));
      try {
        return fs.statSync(abs).isFile();
      } catch {
        return false;
      }
    },
    readFile(p) {
      const abs = path.resolve(root, toRelativePosix(rootPosix, p));
      try {
        return fs.readFileSync(abs, 'utf8');
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * Descubre los archivos fuente y de prueba en el repositorio real.
 * @param {string} root
 * @returns {string[]}
 */
export function discoverCodeFiles(root) {
  const results = [];

  function walk(absDir, relDir) {
    if (!fs.existsSync(absDir)) return;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const absPath = path.join(absDir, entry.name);
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(absPath, relPath);
      } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(relPath);
      }
    }
  }

  for (const scanRoot of SCAN_ROOTS) {
    walk(path.join(root, scanRoot), scanRoot);
  }
  return results.sort();
}

function getPackageConfig(relFile, root, host) {
  const rootPosix = toPosixPath(root);
  if (relFile.startsWith('apps/frontend/')) {
    return {
      packageDir: `${rootPosix}/apps/frontend`,
      tsconfigPath: 'apps/frontend/tsconfig.json',
      compilerOptions: loadCompilerOptions('apps/frontend/tsconfig.json', rootPosix, host, {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowJs: true,
        resolveJsonModule: true,
        baseUrl: `${rootPosix}/apps/frontend`,
        paths: { '@/*': ['./src/*'] },
      }),
    };
  }
  if (relFile.startsWith('apps/backend/')) {
    return {
      packageDir: `${rootPosix}/apps/backend`,
      tsconfigPath: 'apps/backend/tsconfig.json',
      compilerOptions: loadCompilerOptions('apps/backend/tsconfig.json', rootPosix, host, {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        allowJs: true,
        resolveJsonModule: true,
      }),
    };
  }
  return {
    packageDir: `${rootPosix}/packages/shared`,
    tsconfigPath: 'packages/shared/tsconfig.json',
    compilerOptions: loadCompilerOptions('packages/shared/tsconfig.json', rootPosix, host, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: true,
      resolveJsonModule: true,
    }),
  };
}

function loadCompilerOptions(tsconfigRel, rootPosix, host, fallback) {
  const raw = host.readFile(tsconfigRel);
  if (!raw) return fallback;
  const parsed = ts.readConfigFile(tsconfigRel, () => raw);
  if (parsed.error || !parsed.config) return fallback;
  const basePath = `${rootPosix}/${path.posix.dirname(tsconfigRel)}`;
  const configHost = {
    useCaseSensitiveFileNames: true,
    readDirectory: () => [],
    fileExists: (f) => host.fileExists(f),
    readFile: (f) => host.readFile(f),
  };
  const result = ts.parseJsonConfigFileContent(parsed.config, configHost, basePath);
  if (!result.options || Object.keys(result.options).length === 0) return fallback;
  return {
    ...fallback,
    ...result.options,
    allowJs: true,
    resolveJsonModule: true,
  };
}

function isInternalSpecifier(specifier) {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/') ||
    specifier.startsWith('@/') ||
    specifier === '@sigoa/shared' ||
    specifier.startsWith('@sigoa/shared/')
  );
}

function tryCandidatePaths(basePosix, host) {
  const candidates = [];
  const ext = path.posix.extname(basePosix).toLowerCase();

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    const stem = basePosix.slice(0, -ext.length);
    candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, basePosix);
  } else if (ext) {
    candidates.push(basePosix);
  } else {
    candidates.push(
      `${basePosix}.ts`,
      `${basePosix}.tsx`,
      `${basePosix}.mts`,
      `${basePosix}.js`,
      `${basePosix}.jsx`,
      `${basePosix}.mjs`,
      `${basePosix}/index.ts`,
      `${basePosix}/index.tsx`,
      `${basePosix}/index.js`,
      `${basePosix}/index.mjs`,
    );
  }

  for (const candidate of candidates) {
    if (host.fileExists(candidate)) return candidate;
  }
  return null;
}

function resolveSpecifier(specifier, containingRel, rootPosix, host, compilerOptions) {
  if (specifier === '@sigoa/shared') {
    const entry = tryCandidatePaths('packages/shared/src/index', host);
    return entry;
  }
  if (specifier.startsWith('@sigoa/shared/')) {
    const sub = specifier.slice('@sigoa/shared/'.length);
    return tryCandidatePaths(`packages/shared/src/${sub}`, host);
  }

  if (specifier.startsWith('@/') && containingRel.startsWith('apps/frontend/')) {
    const sub = specifier.slice(2);
    const aliasHit = tryCandidatePaths(`apps/frontend/src/${sub}`, host);
    if (aliasHit) return aliasHit;
  }

  const absContaining = `${rootPosix}/${containingRel}`;
  const resolutionHost = {
    fileExists: (f) => host.fileExists(f),
    readFile: (f) => host.readFile(f),
  };

  const resolved = ts.resolveModuleName(specifier, absContaining, compilerOptions, resolutionHost);
  if (resolved.resolvedModule?.resolvedFileName) {
    const relResolved = toRelativePosix(rootPosix, resolved.resolvedModule.resolvedFileName);
    if (!relResolved.includes('node_modules/') && host.fileExists(relResolved)) {
      return relResolved;
    }
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const dir = path.posix.dirname(containingRel);
    const joined = toPosixPath(path.posix.join(dir, specifier));
    return tryCandidatePaths(joined, host);
  }

  return null;
}

/**
 * Extrae imports, re-exports, exports locales y llamadas dinámicas/vi.mock de un SourceFile.
 * @param {ts.SourceFile} sourceFile
 */
export function extractModuleSyntax(sourceFile) {
  const imports = [];
  const localExports = new Set();
  const reexports = [];
  let hasDefaultExport = false;

  function addNamedBinding(specifier, node) {
    const record = {
      specifier,
      kind: 'static',
      isTypeOnly: Boolean(node.importClause?.isTypeOnly),
      defaultImport: Boolean(node.importClause?.name),
      namespaceImport: false,
      named: [],
    };
    const bindings = node.importClause?.namedBindings;
    if (bindings) {
      if (ts.isNamespaceImport(bindings)) {
        record.namespaceImport = true;
      } else if (ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          record.named.push(el.propertyName ? el.propertyName.text : el.name.text);
        }
      }
    }
    imports.push(record);
  }

  function hasExportModifier(node) {
    return Boolean(
      ts.canHaveModifiers(node) &&
        ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
    );
  }

  function hasDefaultModifier(node) {
    return Boolean(
      ts.canHaveModifiers(node) &&
        ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
    );
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      addNamedBinding(node.moduleSpecifier.text, node);
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        imports.push({
          specifier: spec,
          kind: 'reexport',
          isTypeOnly: Boolean(node.isTypeOnly),
          defaultImport: false,
          namespaceImport: !node.exportClause,
          named:
            node.exportClause && ts.isNamedExports(node.exportClause)
              ? node.exportClause.elements.map((e) => (e.propertyName ? e.propertyName.text : e.name.text))
              : [],
        });

        if (!node.exportClause) {
          reexports.push({ specifier: spec, star: true, names: [] });
        } else if (ts.isNamedExports(node.exportClause)) {
          reexports.push({
            specifier: spec,
            star: false,
            names: node.exportClause.elements.map((e) => ({
              exported: e.name.text,
              imported: e.propertyName ? e.propertyName.text : e.name.text,
            })),
          });
        }
      } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          localExports.add(el.name.text);
        }
      }
    } else if (ts.isExportAssignment(node)) {
      hasDefaultExport = true;
      localExports.add('default');
    } else if (hasExportModifier(node)) {
      if (hasDefaultModifier(node)) {
        hasDefaultExport = true;
        localExports.add('default');
      }
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node)) &&
        node.name
      ) {
        localExports.add(node.name.text);
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            localExports.add(decl.name.text);
          } else if (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name)) {
            for (const el of decl.name.elements) {
              if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
                localExports.add(el.name.text);
              }
            }
          }
        }
      }
    } else if (ts.isCallExpression(node)) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          imports.push({
            specifier: firstArg.text,
            kind: 'dynamic',
            isTypeOnly: false,
            defaultImport: false,
            namespaceImport: true,
            named: [],
          });
        } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
          imports.push({
            specifier: firstArg.text,
            kind: 'require',
            isTypeOnly: false,
            defaultImport: false,
            namespaceImport: true,
            named: [],
          });
        } else if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'vi' &&
          VI_MODULE_METHODS.has(node.expression.name.text)
        ) {
          imports.push({
            specifier: firstArg.text,
            kind: `vi.${node.expression.name.text}`,
            isTypeOnly: false,
            defaultImport: false,
            namespaceImport: true,
            named: [],
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { imports, localExports, reexports, hasDefaultExport };
}

/**
 * Construye el grafo de dependencias de archivos usando el compilador de TypeScript.
 * @param {{ root?: string, files?: string[], host?: { readFile?: (p: string) => string | undefined, fileExists?: (p: string) => boolean } }} [options]
 */
export function buildGraph(options = {}) {
  const root = options.root ? toPosixPath(options.root) : toPosixPath(process.cwd());
  const host = createNormalizedHost(root, options.host);
  const rawFiles = options.files ?? discoverCodeFiles(root);

  const nodes = new Set();
  const edges = new Map();
  const reverse = new Map();
  const imports = new Map();
  const exportsMap = new Map();
  const unresolved = [];

  for (const raw of rawFiles) {
    const rel = toRelativePosix(root, raw);
    if (!rel) continue;
    nodes.add(rel);
    if (!edges.has(rel)) edges.set(rel, new Set());
    if (!reverse.has(rel)) reverse.set(rel, new Set());
  }

  const pkgOptionsCache = new Map();

  for (const rel of nodes) {
    const content = host.readFile(rel);
    if (content === undefined) continue;

    const pkgKey = rel.startsWith('apps/frontend/')
      ? 'frontend'
      : rel.startsWith('apps/backend/')
        ? 'backend'
        : 'shared';
    if (!pkgOptionsCache.has(pkgKey)) {
      pkgOptionsCache.set(pkgKey, getPackageConfig(rel, root, host).compilerOptions);
    }
    const compilerOptions = pkgOptionsCache.get(pkgKey);

    const sourceFile = ts.createSourceFile(rel, content, ts.ScriptTarget.ES2022, true, getScriptKind(rel));
    const syntax = extractModuleSyntax(sourceFile);

    const resolvedImports = [];
    for (const imp of syntax.imports) {
      if (!isInternalSpecifier(imp.specifier)) continue;

      const target = resolveSpecifier(imp.specifier, rel, root, host, compilerOptions);
      if (target) {
        if (!nodes.has(target)) {
          nodes.add(target);
          edges.set(target, new Set());
          reverse.set(target, new Set());
        }
        edges.get(rel).add(target);
        reverse.get(target).add(rel);
        resolvedImports.push({ ...imp, target });
      } else {
        unresolved.push({ file: rel, specifier: imp.specifier });
      }
    }

    const resolvedReexports = [];
    for (const re of syntax.reexports) {
      if (!isInternalSpecifier(re.specifier)) continue;
      const target = resolveSpecifier(re.specifier, rel, root, host, compilerOptions);
      if (target) {
        resolvedReexports.push({ ...re, target });
      }
    }

    imports.set(rel, resolvedImports);
    exportsMap.set(rel, {
      localExports: syntax.localExports,
      reexports: resolvedReexports,
      hasDefaultExport: syntax.hasDefaultExport,
    });
  }

  return {
    root,
    nodes,
    edges,
    reverse,
    imports,
    exports: exportsMap,
    unresolved,
  };
}
