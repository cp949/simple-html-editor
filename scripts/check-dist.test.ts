import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { assertDistFileSet, checkDist } from './check-dist.mjs';

const requiredFiles = ['index.js', 'index.d.ts', 'styles.css', 'package.json'] as const;

async function createFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'editor-simple-dist-'));
  await Promise.all(requiredFiles.map((file) => writeFile(join(directory, file), '')));
  return directory;
}

async function createValidDistFixture(indexJavaScript: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'editor-simple-valid-dist-'));
  await Promise.all([
    writeFile(join(directory, 'index.js'), indexJavaScript),
    writeFile(join(directory, 'index.d.ts'), 'export declare const value: unknown\n'),
    writeFile(join(directory, 'styles.css'), ''),
    writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
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
      }),
    ),
  ]);
  return directory;
}

describe('dist 파일 집합 검사', () => {
  test.each(requiredFiles)('%s가 symlink면 거부한다', async (requiredFile) => {
    const fixtureDirectory = await createFixture();

    try {
      await rm(join(fixtureDirectory, requiredFile));
      const targetFile = requiredFile === 'index.js' ? 'package.json' : 'index.js';
      await symlink(targetFile, join(fixtureDirectory, requiredFile));

      await expect(assertDistFileSet(fixtureDirectory)).rejects.toThrow(
        `dist 필수 파일이 regular file이 아닙니다: ${requiredFile}`,
      );
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  test.each([
    {
      name: '중첩 디렉터리',
      create: (directory: string) => mkdir(join(directory, 'nested')),
    },
    {
      name: '추가 파일',
      create: (directory: string) => writeFile(join(directory, 'extra.js'), ''),
    },
    {
      name: '추가 symlink',
      create: (directory: string) => symlink('index.js', join(directory, 'extra-link')),
    },
  ])('$name entry가 있으면 거부한다', async ({ create }) => {
    const fixtureDirectory = await createFixture();

    try {
      await create(fixtureDirectory);

      await expect(assertDistFileSet(fixtureDirectory)).rejects.toThrow(
        'dist 파일 목록이 정확하지 않습니다',
      );
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });
});

// Production break: ES2019 post-transform이 제거되어도 dist 검사가 통과한다.
test('dist JavaScript의 ES2020 문법을 거부한다', async () => {
  const fixtureDirectory = await createValidDistFixture('export const value = globalThis?.value\n');

  try {
    await expect(checkDist(fixtureDirectory)).rejects.toThrow('ES2019 문법 검사');
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});

// Production break: runtime checker가 React 18 또는 React 19 소비자에서 dist를 검사하지 않는다.
test('React 18과 React 19 소비자에서 dist runtime을 검사한다', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/check-dist.mjs')], {
    encoding: 'utf8',
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('React 18 dist runtime 호환성 검사 통과');
  expect(result.stdout).toContain('React 19 dist runtime 호환성 검사 통과');
  expect(result.stdout).toContain('Chrome 85 runtime 호환성 검사 통과');
});
