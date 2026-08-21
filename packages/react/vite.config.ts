import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { defineConfig, esmExternalRequirePlugin, transformWithOxc } from 'vite';

import packageJson from './package.json' with { type: 'json' };

const entryFile = resolve(import.meta.dirname, 'src/index.ts');
const rootDirectory = resolve(import.meta.dirname, '../..');
const bundleMetadataFile = resolve(import.meta.dirname, '.bundle/bundle-modules.json');
const compareStrings = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const externalPackages = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
];
const isExternal = (id: string) =>
  externalPackages.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  plugins: [
    esmExternalRequirePlugin({
      external: externalPackages,
    }),
    {
      name: 'simple-html-editor-styles',
      transform(code, id) {
        return id === entryFile ? `import './styles.css'\n${code}` : undefined;
      },
    },
    {
      name: 'simple-html-editor-es2019-syntax',
      enforce: 'post',
      async generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') {
            continue;
          }

          const transformed = await transformWithOxc(output.code, output.fileName, {
            target: 'es2019',
            lang: 'js',
            sourceType: 'module',
            sourcemap: false,
          });
          output.code = transformed.code;
          output.map = null;
        }
      },
    },
    {
      name: 'simple-html-editor-bundle-metadata',
      enforce: 'post',
      async generateBundle(_options, bundle) {
        const modules = new Set<string>();
        const externalImports = new Set<string>();
        const entryChunk = Object.values(bundle).find(
          (output) => output.type === 'chunk' && output.isEntry,
        );

        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          for (const moduleId of Object.keys(output.modules)) {
            const cleanModuleId = moduleId.split('?')[0];
            if (!cleanModuleId.startsWith('\0')) {
              modules.add(relative(rootDirectory, cleanModuleId));
            }
          }
          for (const specifier of [...output.imports, ...output.dynamicImports]) {
            if (!specifier.startsWith('.')) externalImports.add(specifier);
          }
        }

        if (!entryChunk) throw new Error('simple-html-editor entry chunk가 없습니다.');
        await mkdir(resolve(bundleMetadataFile, '..'), { recursive: true });
        await writeFile(
          bundleMetadataFile,
          `${JSON.stringify(
            {
              version: 1,
              bundle: {
                file: relative(
                  rootDirectory,
                  resolve(import.meta.dirname, 'dist', entryChunk.fileName),
                ),
                sha256: createHash('sha256').update(entryChunk.code).digest('hex'),
              },
              modules: [...modules].sort(compareStrings),
              externalImports: [...externalImports].sort(compareStrings),
            },
            null,
            2,
          )}\n`,
        );
      },
    },
  ],
  build: {
    target: 'chrome81',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: entryFile,
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: isExternal,
    },
  },
});
