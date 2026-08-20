import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { parse } from 'acorn';
import { build, optimizeDeps, resolveConfig } from 'vite';

const demoDirectory = resolve('apps/demo');

function assertChrome81Syntax(source, artifact) {
  assert.doesNotThrow(
    () => parse(source, { ecmaVersion: 2020, sourceType: 'module' }),
    `${artifact}에 Chrome 81이 해석할 수 없는 문법이 있습니다.`,
  );
}

// Production break: dev dependency prebundle target이 Chrome 85로 돌아가 React DOM의 ??=가 노출된다.
test('demo dev dependency prebundle은 Chrome 81 문법으로 해석된다', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'editor-demo-deps-'));

  try {
    const config = await resolveConfig(
      {
        root: demoDirectory,
        cacheDir: cacheDirectory,
        logLevel: 'silent',
      },
      'serve',
    );
    const metadata = await optimizeDeps(config, true, true);
    const reactDomClient = metadata.optimized['react-dom/client'];

    assert.ok(reactDomClient, 'react-dom/client dependency prebundle이 없습니다.');
    assertChrome81Syntax(await readFile(reactDomClient.file, 'utf8'), 'react-dom/client prebundle');
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

// Production break: production build target이 Chrome 85로 돌아가 logical assignment가 노출된다.
test('demo production JavaScript는 Chrome 81 문법으로 해석된다', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'editor-demo-build-'));

  try {
    await build({
      root: demoDirectory,
      logLevel: 'silent',
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
      },
    });
    const assetsDirectory = join(outputDirectory, 'assets');
    const javascriptFiles = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'));

    assert.ok(javascriptFiles.length > 0, 'demo production JavaScript 산출물이 없습니다.');
    for (const file of javascriptFiles) {
      assertChrome81Syntax(await readFile(join(assetsDirectory, file), 'utf8'), file);
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
