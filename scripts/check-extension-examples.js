#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_ROOT = path.join(ROOT, 'extension-examples');
const MODULES_FILE = path.join(ROOT, 'src', 'modules.ts');
const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function readKnownModules() {
  const source = fs.readFileSync(MODULES_FILE, 'utf8');
  const modules = new Set();
  const pattern = /case '([^']+)':/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    modules.add(match[1]);
  }

  return modules;
}

function listExampleEntrypoints() {
  if (!fs.existsSync(EXAMPLES_ROOT)) {
    throw new Error(
      "Missing 'extension-examples'. Run `git submodule update --init --recursive`."
    );
  }

  const entries = [];
  const examples = fs
    .readdirSync(EXAMPLES_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort();

  for (const example of examples) {
    const srcDir = path.join(EXAMPLES_ROOT, example, 'src');
    const candidates = [
      path.join(srcDir, 'index.ts'),
      path.join(srcDir, 'index.tsx'),
      path.join(srcDir, 'index.js'),
      path.join(srcDir, 'index.jsx')
    ];
    const entrypoint = candidates.find(candidate => fs.existsSync(candidate));
    if (entrypoint) {
      entries.push({ example, entrypoint });
    }
  }

  return entries;
}

function createSourceFile(filePath, source) {
  const extension = path.extname(filePath);
  let scriptKind = ts.ScriptKind.TS;

  if (extension === '.tsx') {
    scriptKind = ts.ScriptKind.TSX;
  } else if (extension === '.js') {
    scriptKind = ts.ScriptKind.JS;
  } else if (extension === '.jsx') {
    scriptKind = ts.ScriptKind.JSX;
  }

  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
}

function collectModuleSpecifiers(filePath, source) {
  const sourceFile = createSourceFile(filePath, source);
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function resolveRelativeImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  if (path.extname(base)) {
    return fs.existsSync(base) ? base : null;
  }

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx')
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
}

function transpileDiagnostics(filePath, source) {
  const result = ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2017,
      jsx: ts.JsxEmit.React,
      allowJs: true
    },
    reportDiagnostics: true
  });

  return result.diagnostics ?? [];
}

function formatDiagnostic(filePath, diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const position = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start
    );
    return `${filePath}:${position.line + 1}:${
      position.character + 1
    } ${message}`;
  }
  return `${filePath}: ${message}`;
}

function validateEntrypoint(entrypoint, knownModules) {
  const queue = [entrypoint];
  const visited = new Set();
  const failures = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const source = fs.readFileSync(current, 'utf8');
    const diagnostics = transpileDiagnostics(current, source);
    failures.push(
      ...diagnostics.map(diagnostic => formatDiagnostic(current, diagnostic))
    );

    for (const specifier of collectModuleSpecifiers(current, source)) {
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(current, specifier);
        if (!resolved) {
          failures.push(`${current}: unresolved relative import ${specifier}`);
          continue;
        }
        if (SCRIPT_EXTENSIONS.has(path.extname(resolved))) {
          queue.push(resolved);
        }
        continue;
      }

      if (!knownModules.has(specifier)) {
        failures.push(`${current}: unknown external module ${specifier}`);
      }
    }
  }

  return failures;
}

function main() {
  const knownModules = readKnownModules();
  const entrypoints = listExampleEntrypoints();
  let checked = 0;
  let failed = false;

  for (const { example, entrypoint } of entrypoints) {
    const failures = validateEntrypoint(entrypoint, knownModules);
    if (failures.length > 0) {
      failed = true;
      console.error(`\n[${example}] validation failed`);
      for (const failure of failures) {
        console.error(`  ${failure}`);
      }
      continue;
    }
    checked += 1;
  }

  if (failed) {
    process.exit(1);
  }

  console.log(
    `Validated ${checked} extension examples for transpilation and import resolution.`
  );
}

main();
