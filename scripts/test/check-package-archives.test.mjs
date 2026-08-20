import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertArchiveVersions,
  assertPackedFiles,
  packageInstallArguments,
} from '../check-package-archives.mjs';

test('React pack allowlist 밖의 파일을 거부한다', () => {
  assert.throws(
    () =>
      assertPackedFiles('react', [
        'index.js',
        'index.d.ts',
        'styles.css',
        'package.json',
        'src.ts',
      ]),
    /unexpected packed file: src\.ts/,
  );
});

test('core와 React archive version 불일치를 거부한다', () => {
  assert.throws(
    () => assertArchiveVersions({ core: '0.1.0', react: '0.1.1' }),
    /archive versions must match: core=0\.1\.0, react=0\.1\.1/,
  );
});

test('정확한 core와 React pack file set을 허용한다', () => {
  assert.doesNotThrow(() =>
    assertPackedFiles('core', [
      'empty-document.d.ts',
      'extensions.d.ts',
      'html-policy.d.ts',
      'image-presentation.d.ts',
      'index.d.ts',
      'index.js',
      'package.json',
    ]),
  );
  assert.doesNotThrow(() =>
    assertPackedFiles('react', ['index.d.ts', 'index.js', 'package.json', 'styles.css']),
  );
});

test('격리 소비 설치는 registry fallback을 허용하지 않는다', () => {
  const args = packageInstallArguments('/tmp/package-store');
  assert.ok(args.includes('--offline'));
  assert.ok(!args.includes('--prefer-offline'));
  assert.deepEqual(args.slice(-2), ['--store-dir', '/tmp/package-store']);
});
