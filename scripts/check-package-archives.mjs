import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const packageContracts = {
  core: {
    directory: path.join(workspaceRoot, 'packages/core/dist'),
    files: [
      'empty-document.d.ts',
      'extensions.d.ts',
      'html-policy.d.ts',
      'image-presentation.d.ts',
      'index.d.ts',
      'index.js',
      'package.json',
    ],
    name: '@cp949/simple-html-editor-core',
  },
  react: {
    directory: path.join(workspaceRoot, 'packages/react/dist'),
    files: ['index.d.ts', 'index.js', 'package.json', 'styles.css'],
    name: '@cp949/simple-html-editor-react',
  },
};

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function assertPackedFiles(kind, files) {
  const expected = packageContracts[kind]?.files;
  if (!expected) throw new Error(`unknown package kind: ${kind}`);

  const actual = [...files].sort(compareStrings);
  const sortedExpected = [...expected].sort(compareStrings);
  const unexpected = actual.find((file) => !sortedExpected.includes(file));
  if (unexpected) throw new Error(`unexpected packed file: ${unexpected}`);
  const missing = sortedExpected.find((file) => !actual.includes(file));
  if (missing) throw new Error(`missing packed file: ${missing}`);
}

export function assertArchiveVersions({ core, react }) {
  if (core !== react) {
    throw new Error(`archive versions must match: core=${core}, react=${react}`);
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .map((value) => value.trim())
      .filter(Boolean)
      .join('\n');
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}:\n${output}`);
  }
  return result.stdout;
}

function parsePackResult(stdout, command) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${command} returned invalid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(`${command} must return exactly one package result`);
  }
  return parsed[0];
}

function inspectPackage(kind) {
  const contract = packageContracts[kind];
  const result = parsePackResult(
    run('npm', ['pack', '--dry-run', '--json'], contract.directory),
    `npm pack --dry-run (${kind})`,
  );
  if (result.name !== contract.name) {
    throw new Error(`${kind} archive name must be ${contract.name}: ${result.name}`);
  }
  assertPackedFiles(
    kind,
    result.files.map((file) => file.path),
  );
  return result;
}

function createArchive(kind, destination) {
  const contract = packageContracts[kind];
  const result = parsePackResult(
    run('npm', ['pack', '--json', '--pack-destination', destination], contract.directory),
    `npm pack (${kind})`,
  );
  assertPackedFiles(
    kind,
    result.files.map((file) => file.path),
  );
  return { ...result, path: path.join(destination, result.filename) };
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function installScenario(root, relativeDirectory, manifest, overrides = {}) {
  await mkdir(root, { recursive: true });
  const overrideLines = Object.entries(overrides).map(
    ([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`,
  );
  await writeFile(
    path.join(root, 'pnpm-workspace.yaml'),
    `packages:\n  - '**'\n${overrideLines.length > 0 ? `overrides:\n${overrideLines.join('\n')}\n` : ''}`,
  );
  const directory = path.join(root, relativeDirectory);
  await mkdir(directory, { recursive: true });
  await writeJson(path.join(directory, 'package.json'), manifest);
  run('pnpm', ['install', '--prefer-offline', '--ignore-scripts'], directory);
  return directory;
}

async function checkCoreConsumer(root, coreArchive) {
  const directory = await installScenario(root, 'packages/core', {
    name: 'core-archive-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@cp949/simple-html-editor-core': `file:${coreArchive}`,
    },
    devDependencies: {
      typescript: '6.0.3',
    },
  });
  await writeJson(path.join(directory, 'tsconfig.json'), {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      strict: true,
      target: 'ES2022',
    },
    include: ['consumer.ts'],
  });
  await writeFile(
    path.join(directory, 'consumer.ts'),
    `import {
  createHtmlEditorExtensions,
  isAllowedImageSrc,
  isAllowedLinkHref,
  isEditorDocumentEmpty,
  selectedImageAlignment,
} from '@cp949/simple-html-editor-core';

void createHtmlEditorExtensions();
void isAllowedImageSrc('https://example.com/image.png');
void isAllowedLinkHref('/relative');
void isEditorDocumentEmpty({ type: 'doc', content: [] });
const selectAlignment: typeof selectedImageAlignment = selectedImageAlignment;
void selectAlignment;
`,
  );
  await writeFile(
    path.join(directory, 'runtime.mjs'),
    `import { isAllowedImageSrc, isAllowedLinkHref } from '@cp949/simple-html-editor-core';
if (!isAllowedImageSrc('https://example.com/image.png')) throw new Error('image policy import failed');
if (!isAllowedLinkHref('/relative')) throw new Error('link policy import failed');
`,
  );
  run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json'], directory);
  run(process.execPath, ['runtime.mjs'], directory);
  console.log('core archive isolated consumption passed');
}

async function checkReactConsumer(root, archives, scenario) {
  const fixtureDirectory =
    scenario.label === 'React 18' ? 'fixtures/consumer-react18' : 'fixtures/consumer';
  const directory = await installScenario(
    root,
    fixtureDirectory,
    {
      name: `${scenario.label.toLowerCase().replace(' ', '-')}-archive-consumer`,
      private: true,
      type: 'module',
      dependencies: {
        '@cp949/simple-html-editor-core': `file:${archives.core}`,
        '@cp949/simple-html-editor-react': `file:${archives.react}`,
        react: scenario.react,
        'react-dom': scenario.reactDom,
      },
      devDependencies: {
        '@types/react': scenario.typesReact,
        '@types/react-dom': scenario.typesReactDom,
        typescript: '6.0.3',
      },
    },
    { '@cp949/simple-html-editor-core': `file:${archives.core}` },
  );
  await writeJson(path.join(directory, 'tsconfig.json'), {
    compilerOptions: {
      jsx: 'react-jsx',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      strict: true,
      target: 'ES2022',
    },
    include: ['consumer.tsx', 'styles.d.ts'],
  });
  await writeFile(
    path.join(directory, 'styles.d.ts'),
    "declare module '@cp949/simple-html-editor-react/styles.css';\n",
  );
  await writeFile(
    path.join(directory, 'consumer.tsx'),
    `import { createElement } from 'react';
import {
  HtmlEditor,
  type HtmlEditorHandle,
  type HtmlEditorProps,
} from '@cp949/simple-html-editor-react';
import '@cp949/simple-html-editor-react/styles.css';

const props: HtmlEditorProps = { value: undefined, onChange: () => undefined };
const handle: HtmlEditorHandle | null = null;
void handle;
void createElement(HtmlEditor, props);
`,
  );
  await writeFile(
    path.join(directory, 'runtime.mjs'),
    `const library = await import('@cp949/simple-html-editor-react');
if (!library.HtmlEditor) throw new Error('HtmlEditor SSR import failed');
`,
  );
  run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json'], directory);
  run(process.execPath, ['runtime.mjs'], directory);
  console.log(`${scenario.label} archive isolated consumption passed`);
}

async function main() {
  const dryRunCore = inspectPackage('core');
  const dryRunReact = inspectPackage('react');
  assertArchiveVersions({ core: dryRunCore.version, react: dryRunReact.version });

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'simple-html-editor-archives-'));
  try {
    const core = createArchive('core', temporaryRoot);
    const react = createArchive('react', temporaryRoot);
    assertArchiveVersions({ core: core.version, react: react.version });
    await checkCoreConsumer(path.join(temporaryRoot, 'core-scenario'), core.path);
    for (const scenario of [
      {
        label: 'React 18',
        react: '18.3.1',
        reactDom: '18.3.1',
        typesReact: '18.3.31',
        typesReactDom: '18.3.7',
      },
      {
        label: 'React 19',
        react: '19.2.8',
        reactDom: '19.2.8',
        typesReact: '19.2.18',
        typesReactDom: '19.2.4',
      },
    ]) {
      await checkReactConsumer(
        path.join(temporaryRoot, `${scenario.label.toLowerCase().replace(' ', '-')}-scenario`),
        { core: core.path, react: react.path },
        scenario,
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  console.log('package archive contract passed');
}

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
