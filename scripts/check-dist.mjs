import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'acorn';

const rootDirectory = resolve(import.meta.dirname, '..');
const releaseVersion = JSON.parse(
  await readFile(join(rootDirectory, 'package.json'), 'utf8'),
).version;
const contracts = {
  core: {
    directory: join(rootDirectory, 'packages/core/dist'),
    name: '@cp949/simple-html-editor-core',
    requiredFiles: [
      'empty-document.d.ts',
      'extensions.d.ts',
      'html-policy.d.ts',
      'image-presentation.d.ts',
      'index.d.ts',
      'index.js',
      'package.json',
    ],
  },
  react: {
    directory: join(rootDirectory, 'packages/react/dist'),
    name: '@cp949/simple-html-editor-react',
    requiredFiles: ['index.js', 'index.d.ts', 'styles.css', 'package.json'],
  },
};

export async function assertDistFileSet(directory, requiredFiles = contracts.react.requiredFiles) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const file of requiredFiles) {
    const entry = entries.find((candidate) => candidate.name === file);
    if (!entry) {
      throw new Error(`dist 필수 파일이 없습니다: ${file}`);
    }
    if (!entry.isFile()) {
      throw new Error(`dist 필수 파일이 regular file이 아닙니다: ${file}`);
    }
    await readFile(join(directory, file));
  }

  const actualFiles = entries.map((entry) => entry.name).sort();
  const expectedFiles = [...requiredFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`dist 파일 목록이 정확하지 않습니다: ${actualFiles.join(', ')}`);
  }
}

async function listDeclarations(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const declarations = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      declarations.push(...(await listDeclarations(path)));
    } else if (entry.name.endsWith('.d.ts')) {
      declarations.push(path);
    }
  }

  return declarations;
}

async function assertPublicDeclarations(directory) {
  const forbiddenImport = /['"](?:@tiptap\/|prosemirror-)/;

  for (const path of await listDeclarations(directory)) {
    const declaration = await readFile(path, 'utf8');
    if (forbiddenImport.test(declaration)) {
      throw new Error(
        `공개 선언에 Tiptap/ProseMirror import가 노출되었습니다: ${relative(directory, path)}`,
      );
    }
  }
}

async function assertCoreDeclarations(directory) {
  const declaration = await readFile(join(directory, 'index.d.ts'), 'utf8');
  const relativeSpecifiers = [...declaration.matchAll(/from ['"](\.\/[^'"]+)['"]/g)].map(
    (match) => match[1],
  );

  for (const specifier of relativeSpecifiers) {
    if (!specifier.endsWith('.js')) {
      throw new Error(`core 공개 선언의 상대 export에 .js 확장자가 없습니다: ${specifier}`);
    }
    await readFile(join(directory, specifier.replace(/\.js$/, '.d.ts')));
  }
}

async function assertJavaScriptSyntax(directory) {
  const javascript = await readFile(join(directory, 'index.js'), 'utf8');

  try {
    parse(javascript, { ecmaVersion: 2019, sourceType: 'module' });
  } catch (error) {
    throw new Error('dist/index.js ES2019 문법 검사에 실패했습니다.', { cause: error });
  }
}

async function assertPackageMetadata(directory, kind) {
  const packageJson = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const contract = contracts[kind];

  const expectedFields = {
    name: contract.name,
    version: releaseVersion,
    type: 'module',
    main: './index.js',
    types: './index.d.ts',
  };

  for (const [field, expected] of Object.entries(expectedFields)) {
    if (packageJson[field] !== expected) {
      throw new Error(`dist/package.json ${field} 값이 ${JSON.stringify(expected)}가 아닙니다.`);
    }
  }

  const rootExport = packageJson.exports?.['.'];
  if (rootExport?.types !== './index.d.ts' || rootExport?.import !== './index.js') {
    throw new Error('dist/package.json의 "." export가 JavaScript와 타입 선언을 제공하지 않습니다.');
  }

  if (packageJson.publishConfig?.access !== 'public' && kind === 'core') {
    throw new Error('core dist/package.json의 publishConfig.access가 public이 아닙니다.');
  }
  for (const [name, specifier] of Object.entries(packageJson.dependencies ?? {})) {
    if (specifier.startsWith('workspace:')) {
      throw new Error(`dist/package.json dependency에 workspace specifier가 남았습니다: ${name}`);
    }
  }

  if (kind === 'react') {
    if (packageJson.exports?.['./styles.css'] !== './styles.css') {
      throw new Error('dist/package.json의 "./styles.css" export가 없습니다.');
    }
    if (packageJson.peerDependencies?.react !== '>=18.3.0 <20') {
      throw new Error('dist/package.json의 React peer 범위가 올바르지 않습니다.');
    }
    if (packageJson.peerDependencies?.['react-dom'] !== '>=18.3.0 <20') {
      throw new Error('dist/package.json의 ReactDOM peer 범위가 올바르지 않습니다.');
    }
  }
}

export async function checkDist(input = {}) {
  const options = typeof input === 'string' ? { directory: input, kind: 'react' } : input;
  const kind = options.kind ?? 'react';
  const contract = contracts[kind];

  if (!contract) throw new Error(`알 수 없는 dist package kind입니다: ${kind}`);
  const directory = options.directory ?? contract.directory;

  await assertDistFileSet(directory, contract.requiredFiles);
  await assertJavaScriptSyntax(directory);
  if (kind === 'react') await assertPublicDeclarations(directory);
  if (kind === 'core') await assertCoreDeclarations(directory);
  await assertPackageMetadata(directory, kind);
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageIndex = process.argv.indexOf('--package');
  const selectedKind = packageIndex === -1 ? undefined : process.argv[packageIndex + 1];
  const kinds = selectedKind ? [selectedKind] : ['core', 'react'];

  for (const kind of kinds) await checkDist({ kind });
  if (kinds.includes('react')) await import('./check-dist-runtime.mjs');
  console.log('dist 계약 검사 통과');
}
