import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { defineConfig, esmExternalRequirePlugin, transformWithEsbuild } from 'vite';

const entryFile = resolve(import.meta.dirname, 'src/index.ts');
const rootDirectory = resolve(import.meta.dirname, '../..');
const bundleMetadataFile = resolve(import.meta.dirname, '.bundle/bundle-modules.json');
const compareStrings = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export default defineConfig({
  plugins: [
    esmExternalRequirePlugin({
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    }),
    {
      name: 'editor-simple-styles',
      transform(code, id) {
        return id === entryFile ? `import './styles.css'\n${code}` : undefined;
      },
    },
    {
      name: 'editor-simple-es2019-syntax',
      enforce: 'post',
      async generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') {
            continue;
          }

          const transformed = await transformWithEsbuild(output.code, output.fileName, {
            target: 'es2019',
            format: 'esm',
            minify: false,
            sourcemap: false,
          });
          output.code = transformed.code;
          output.map = null;
        }
      },
    },
    {
      name: 'editor-simple-bundle-metadata',
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

        if (!entryChunk) throw new Error('editor-simple entry chunk가 없습니다.');
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
    target: 'chrome85',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: entryFile,
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'styles',
    },
  },
});
