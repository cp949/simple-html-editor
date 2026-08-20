import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const packageJson = {
  name: '@cp949/editor-simple',
  version: '0.1.0',
  type: 'module',
  main: './index.js',
  types: './index.d.ts',
  exports: {
    '.': { types: './index.d.ts', import: './index.js' },
    './styles.css': './styles.css',
  },
  peerDependencies: {
    react: '>=18.3.0 <20',
    'react-dom': '>=18.3.0 <20',
  },
};

const distDirectory = resolve(import.meta.dirname, '../dist');
const declarationsToRemove = [
  'compatibility.d.ts',
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
