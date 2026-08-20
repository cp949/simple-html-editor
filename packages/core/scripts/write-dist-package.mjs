import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDirectory = resolve(import.meta.dirname, '../../..');
const distDirectory = resolve(import.meta.dirname, '../dist');
const rootManifest = JSON.parse(await readFile(resolve(rootDirectory, 'package.json'), 'utf8'));
const coreManifest = JSON.parse(
  await readFile(resolve(rootDirectory, 'packages/core/package.json'), 'utf8'),
);

if (rootManifest.version !== coreManifest.version) {
  throw new Error(
    `root/core version이 다릅니다: ${rootManifest.version} != ${coreManifest.version}`,
  );
}

for (const [name, specifier] of Object.entries(coreManifest.dependencies ?? {})) {
  if (specifier.startsWith('workspace:')) {
    throw new Error(`core dependency에 workspace specifier가 남았습니다: ${name}`);
  }
}

const declarationPath = resolve(distDirectory, 'index.d.ts');
const declaration = await readFile(declarationPath, 'utf8');
const rewrittenDeclaration = declaration.replaceAll(
  /from '(\.\/(?:empty-document|extensions|html-policy|image-presentation))';/g,
  "from '$1.js';",
);

if ((rewrittenDeclaration.match(/from '\.\/.+\.js';/g) ?? []).length !== 4) {
  throw new Error('core index.d.ts relative export 구조가 예상과 다릅니다.');
}

await writeFile(declarationPath, rewrittenDeclaration);
await writeFile(
  resolve(distDirectory, 'package.json'),
  `${JSON.stringify(
    {
      name: '@cp949/simple-html-editor-core',
      version: rootManifest.version,
      type: 'module',
      main: './index.js',
      types: './index.d.ts',
      exports: { '.': { types: './index.d.ts', import: './index.js' } },
      dependencies: coreManifest.dependencies,
      publishConfig: { access: 'public' },
    },
    null,
    2,
  )}\n`,
);
