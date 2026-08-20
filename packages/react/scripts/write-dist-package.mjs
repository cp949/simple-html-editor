import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDirectory = resolve(import.meta.dirname, '../../..');
const rootManifest = JSON.parse(await readFile(resolve(rootDirectory, 'package.json'), 'utf8'));
const coreManifest = JSON.parse(
  await readFile(resolve(rootDirectory, 'packages/core/package.json'), 'utf8'),
);
const reactManifest = JSON.parse(
  await readFile(resolve(rootDirectory, 'packages/react/package.json'), 'utf8'),
);
const versions = [rootManifest.version, coreManifest.version, reactManifest.version];

if (new Set(versions).size !== 1) {
  throw new Error(`root/core/react version이 다릅니다: ${versions.join(', ')}`);
}

const dependencies = {
  ...reactManifest.dependencies,
  '@cp949/simple-html-editor-core': rootManifest.version,
};

for (const [name, specifier] of Object.entries(dependencies)) {
  if (specifier.startsWith('workspace:')) {
    throw new Error(`React dependency에 workspace specifier가 남았습니다: ${name}`);
  }
}

const packageJson = {
  name: '@cp949/simple-html-editor-react',
  version: rootManifest.version,
  type: 'module',
  main: './index.js',
  types: './index.d.ts',
  exports: {
    '.': { types: './index.d.ts', import: './index.js' },
    './styles.css': './styles.css',
  },
  dependencies,
  peerDependencies: reactManifest.peerDependencies,
  publishConfig: { access: 'public' },
};

const distDirectory = resolve(import.meta.dirname, '../dist');
const declarationsToRemove = [
  'compatibility.d.ts',
  'createImageNodeViewRenderer.d.ts',
  'HtmlEditor.d.ts',
  'TableControls.d.ts',
  'Toolbar.d.ts',
  'ToolbarButton.d.ts',
  'types.d.ts',
  'useImageInsertion.d.ts',
];

const typesDeclaration = await readFile(resolve(distDirectory, 'types.d.ts'), 'utf8');
const htmlEditorDeclaration = await readFile(resolve(distDirectory, 'HtmlEditor.d.ts'), 'utf8');
const localTypesImport = "import type { HtmlEditorHandle, HtmlEditorProps } from './types';\n";

if (!htmlEditorDeclaration.startsWith(localTypesImport)) {
  throw new Error('HtmlEditor 공개 선언 구조가 예상과 다릅니다.');
}

await writeFile(
  resolve(distDirectory, 'index.d.ts'),
  `${typesDeclaration.trim()}\n\n${htmlEditorDeclaration.slice(localTypesImport.length).trim()}\n`,
);
await Promise.all(declarationsToRemove.map((file) => unlink(resolve(distDirectory, file))));

await writeFile(
  resolve(distDirectory, 'package.json'),
  `${JSON.stringify(packageJson, null, 2)}\n`,
);
