import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { assertDistFileSet, assertReactBundleBoundary, checkDist } from './check-dist.mjs';

// 픽스처가 release version을 하드코딩하면 버전 범프마다 깨지므로 check-dist.mjs처럼 root manifest에서 읽는다.
const releaseVersion: string = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;

const requiredFiles = [
  'index.js',
  'index.d.ts',
  'styles.css',
  'package.json',
  'README.md',
  'LICENSE',
] as const;
const coreRequiredFiles = [
  'empty-document.d.ts',
  'extensions.d.ts',
  'html-policy.d.ts',
  'image-presentation.d.ts',
  'index.d.ts',
  'index.js',
  'package.json',
  'README.md',
  'LICENSE',
] as const;

async function createFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'simple-html-editor-dist-'));
  await Promise.all(requiredFiles.map((file) => writeFile(join(directory, file), '')));
  return directory;
}

async function createValidDistFixture(
  indexJavaScript: string,
  { coreVersion = releaseVersion, version = releaseVersion } = {},
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'simple-html-editor-valid-dist-'));
  await Promise.all([
    writeFile(join(directory, 'index.js'), indexJavaScript),
    writeFile(join(directory, 'index.d.ts'), 'export declare const value: unknown\n'),
    writeFile(join(directory, 'styles.css'), ''),
    writeFile(join(directory, 'README.md'), '# @cp949/simple-html-editor-react\n'),
    writeFile(join(directory, 'LICENSE'), 'MIT License\n'),
    writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: '@cp949/simple-html-editor-react',
        version,
        type: 'module',
        license: 'MIT',
        description: 'React 제어형 WYSIWYG 편집기',
        keywords: ['html', 'editor'],
        homepage: 'https://github.com/cp949/simple-html-editor#readme',
        repository: {
          type: 'git',
          url: 'git+https://github.com/cp949/simple-html-editor.git',
          directory: 'packages/react',
        },
        bugs: 'https://github.com/cp949/simple-html-editor/issues',
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
        dependencies: {
          '@cp949/simple-html-editor-core': coreVersion,
        },
      }),
    ),
  ]);
  return directory;
}

async function createValidCoreDistFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'simple-html-editor-core-dist-'));
  await Promise.all(
    coreRequiredFiles.map((file) => {
      if (file === 'package.json') {
        return writeFile(
          join(directory, file),
          JSON.stringify({
            name: '@cp949/simple-html-editor-core',
            version: releaseVersion,
            type: 'module',
            license: 'MIT',
            description: 'HTML 편집기 정책과 extension 집합',
            keywords: ['html', 'editor'],
            homepage: 'https://github.com/cp949/simple-html-editor#readme',
            repository: {
              type: 'git',
              url: 'git+https://github.com/cp949/simple-html-editor.git',
              directory: 'packages/core',
            },
            bugs: 'https://github.com/cp949/simple-html-editor/issues',
            main: './index.js',
            types: './index.d.ts',
            exports: { '.': { types: './index.d.ts', import: './index.js' } },
            dependencies: { '@tiptap/core': '^3.30.2' },
            publishConfig: { access: 'public' },
          }),
        );
      }

      if (file === 'README.md') {
        return writeFile(join(directory, file), '# @cp949/simple-html-editor-core\n');
      }
      if (file === 'LICENSE') return writeFile(join(directory, file), 'MIT License\n');
      if (file === 'index.js') return writeFile(join(directory, file), 'export const value = 1\n');
      if (file === 'index.d.ts') {
        return writeFile(
          join(directory, file),
          "export { isEditorDocumentEmpty } from './empty-document.js';\n",
        );
      }
      return writeFile(join(directory, file), 'export {};\n');
    }),
  );
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

describe('core dist 계약', () => {
  test('공개 이름, release version과 JavaScript/type export를 제공한다', async () => {
    const directory = await createValidCoreDistFixture();

    try {
      await expect(checkDist({ kind: 'core', directory })).resolves.toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('allowlist 밖의 파일을 거부한다', async () => {
    const directory = await createValidCoreDistFixture();

    try {
      await writeFile(join(directory, 'extra.js'), '');
      await expect(checkDist({ kind: 'core', directory })).rejects.toThrow(
        'dist 파일 목록이 정확하지 않습니다',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

test('React dist는 자신의 version과 다른 core dependency를 거부한다', async () => {
  const directory = await createValidDistFixture('export const value = 1\n', {
    coreVersion: '0.0.0-mismatch',
  });

  try {
    await expect(checkDist({ kind: 'react', directory })).rejects.toThrow(
      'core dependency must equal React version',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('React bundle에 core source가 포함되면 거부한다', () => {
  expect(() =>
    assertReactBundleBoundary({
      modules: ['packages/core/src/index.ts'],
      externalImports: [],
    }),
  ).toThrow('React bundle must externalize @cp949/simple-html-editor-core');
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
  expect(result.stdout).toContain('Chrome 81 runtime 호환성 검사 통과');
});
