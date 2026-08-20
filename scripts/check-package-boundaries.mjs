import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(process.argv[2] ?? process.cwd());
const packages = [
  ['core', 'packages/core/package.json', '@cp949/editor-simple-core'],
  ['react', 'packages/react/package.json', '@cp949/editor-simple'],
  ['demo', 'apps/demo/package.json', '@cp949/editor-simple-demo'],
  ['consumerReact19', 'fixtures/consumer/package.json', '@cp949/editor-simple-consumer'],
  [
    'consumerReact18',
    'fixtures/consumer-react18/package.json',
    '@cp949/editor-simple-consumer-react18',
  ],
];
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const allowedEdges = new Set([
  'react -> core',
  'demo -> react',
  'consumerReact19 -> react',
  'consumerReact18 -> react',
]);

async function readJson(relativePath) {
  const file = path.join(root, relativePath);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${relativePath}: ${error.message}`);
  }
}

function isForbiddenTypeDependency(specifier) {
  return specifier.startsWith('@tiptap/') || specifier.startsWith('prosemirror-');
}

function declarationSpecifiers(sourceFile) {
  const specifiers = sourceFile.typeReferenceDirectives.map(({ fileName }) => fileName);

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

async function resolveRelativeDeclaration(fromFile, specifier) {
  const unresolved = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    unresolved,
    `${unresolved}.d.ts`,
    unresolved.replace(/\.(?:[cm]?js|tsx?|jsx)$/, '.d.ts'),
    path.join(unresolved, 'index.d.ts'),
  ];
  for (const candidate of new Set(candidates)) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // 다음 TypeScript declaration resolution 후보를 확인한다.
    }
  }
  return undefined;
}

function collectTypeEntrypoints(packageJson) {
  const entrypoints = new Set();
  if (typeof packageJson.types === 'string') entrypoints.add(packageJson.types);
  if (typeof packageJson.typings === 'string') entrypoints.add(packageJson.typings);

  function visitExports(value, key) {
    if (typeof value === 'string' && (key === 'types' || value.endsWith('.d.ts'))) {
      entrypoints.add(value);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visitExports(child, childKey);
    }
  }
  visitExports(packageJson.exports, undefined);
  return [...entrypoints];
}

async function inspectPublicDeclarations() {
  const distDirectory = path.join(root, 'packages/react/dist');
  const packageJson = await readJson('packages/react/dist/package.json');
  const pending = collectTypeEntrypoints(packageJson).map((entrypoint) =>
    path.resolve(distDirectory, entrypoint),
  );
  const visited = new Set();
  const failures = [];

  while (pending.length > 0) {
    const declarationPath = pending.pop();
    if (visited.has(declarationPath)) continue;
    visited.add(declarationPath);

    let source;
    try {
      source = await readFile(declarationPath, 'utf8');
    } catch (error) {
      failures.push(
        `Cannot read public declaration ${path.relative(distDirectory, declarationPath)}: ${error.message}`,
      );
      continue;
    }
    const sourceFile = ts.createSourceFile(
      declarationPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const relativePath = path.relative(distDirectory, declarationPath);

    for (const specifier of declarationSpecifiers(sourceFile)) {
      if (isForbiddenTypeDependency(specifier)) {
        failures.push(
          `Public declaration ${relativePath} imports bundled dependency: ${specifier}`,
        );
      } else if (specifier.startsWith('.')) {
        const resolved = await resolveRelativeDeclaration(declarationPath, specifier);
        if (resolved) pending.push(resolved);
      }
    }
    for (const reference of sourceFile.referencedFiles) {
      const resolved = await resolveRelativeDeclaration(declarationPath, reference.fileName);
      if (resolved) pending.push(resolved);
    }
  }

  return failures;
}

async function check() {
  const rootManifest = await readJson('package.json');
  const manifests = new Map();
  for (const [label, manifestPath] of packages) {
    manifests.set(label, await readJson(manifestPath));
  }

  const labelsByPackageName = new Map(
    packages.map(([label, , expectedName]) => [expectedName, label]),
  );
  const failures = [];

  // optionalDependencies도 production install graph에 포함되므로 dependencies와 함께 거부한다.
  // private root의 devDependencies는 workspace orchestration/tooling 용도로 계속 허용한다.
  const rootProductionDependencies = [
    ...Object.keys(rootManifest.dependencies ?? {}),
    ...Object.keys(rootManifest.optionalDependencies ?? {}),
  ].sort();
  if (rootProductionDependencies.length > 0) {
    failures.push(
      `Workspace root must not have production dependencies: ${rootProductionDependencies.join(', ')}`,
    );
  }

  for (const [label, manifestPath, expectedName] of packages) {
    if (manifests.get(label).name !== expectedName) {
      failures.push(`${path.dirname(manifestPath)} package name must be ${expectedName}`);
    }
  }

  const publicManifest = manifests.get('react');
  const peerKeys = Object.keys(publicManifest.peerDependencies ?? {}).sort();
  if (JSON.stringify(peerKeys) !== JSON.stringify(['react', 'react-dom'])) {
    failures.push('Public package peer keys must be exactly react, react-dom');
  }
  for (const peer of ['react', 'react-dom']) {
    if (publicManifest.peerDependencies?.[peer] !== '>=18.3.0 <20') {
      failures.push(`${peer} peer range must be >=18.3.0 <20`);
    }
    if (
      Object.hasOwn(publicManifest.dependencies ?? {}, peer) ||
      Object.hasOwn(publicManifest.optionalDependencies ?? {}, peer)
    ) {
      failures.push(`React must remain peer-only: ${peer}`);
    }
  }

  const observedEdges = new Set();

  for (const [source, manifest] of manifests) {
    for (const section of dependencySections) {
      for (const dependency of Object.keys(manifest[section] ?? {})) {
        const target = labelsByPackageName.get(dependency);
        if (!target) continue;
        const edge = `${source} -> ${target}`;
        observedEdges.add(edge);
        if (!allowedEdges.has(edge)) failures.push(`Disallowed package edge: ${edge}`);
      }
    }
  }

  for (const edge of allowedEdges) {
    if (!observedEdges.has(edge)) failures.push(`Missing package edge: ${edge}`);
  }

  failures.push(...(await inspectPublicDeclarations()));

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }

  console.log('Package boundary check passed');
}

check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
