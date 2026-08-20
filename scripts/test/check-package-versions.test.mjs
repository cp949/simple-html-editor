import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const checker = path.resolve('scripts/check-package-versions.mjs');
const publishGuard = 'node ../../scripts/block-source-publish.mjs';

async function createWorkspace({
  corePrivate,
  corePrepublishOnly = publishGuard,
  coreSpecifier = 'workspace:*',
  coreVersion = '0.1.0',
  reactPrivate,
  reactPrepublishOnly = publishGuard,
  reactVersion = '0.1.0',
  rootVersion = '0.1.0',
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'simple-html-editor-versions-'));
  const manifests = {
    'package.json': {
      name: 'simple-html-editor',
      private: true,
      version: rootVersion,
    },
    'packages/core/package.json': {
      name: '@cp949/simple-html-editor-core',
      version: coreVersion,
      ...(corePrivate === undefined ? {} : { private: corePrivate }),
      publishConfig: { access: 'public' },
      scripts: corePrepublishOnly === null ? {} : { prepublishOnly: corePrepublishOnly },
    },
    'packages/react/package.json': {
      name: '@cp949/simple-html-editor-react',
      version: reactVersion,
      ...(reactPrivate === undefined ? {} : { private: reactPrivate }),
      publishConfig: { access: 'public' },
      scripts: reactPrepublishOnly === null ? {} : { prepublishOnly: reactPrepublishOnly },
      dependencies: {
        '@cp949/simple-html-editor-core': coreSpecifier,
      },
    },
  };

  for (const [relativePath, manifest] of Object.entries(manifests)) {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
}

async function withWorkspace(options, assertion) {
  const root = await createWorkspace(options);
  try {
    await assertion(runChecker(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('루트와 두 공개 package version 불일치를 거부한다', async () => {
  await withWorkspace(
    { rootVersion: '0.1.0', coreVersion: '0.1.1', reactVersion: '0.1.0' },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(
        stderr,
        /release versions must match: root=0\.1\.0, core=0\.1\.1, react=0\.1\.0/,
      );
    },
  );
});

test('공개 package의 private 설정을 거부한다', async () => {
  await withWorkspace({ corePrivate: true }, ({ status, stderr }) => {
    assert.notEqual(status, 0);
    assert.match(stderr, /packages\/core must be publishable/);
  });
});

test('React의 workspace core dependency는 workspace star만 허용한다', async () => {
  await withWorkspace({ coreSpecifier: 'workspace:^' }, ({ status, stderr }) => {
    assert.notEqual(status, 0);
    assert.match(stderr, /React core dependency must be workspace:\*/);
  });
});

test('source package의 publish guard 누락을 거부한다', async () => {
  await withWorkspace({ corePrepublishOnly: null }, ({ status, stderr }) => {
    assert.notEqual(status, 0);
    assert.match(stderr, /packages\/core prepublishOnly must block source-root publication/);
  });
});

test('누락되거나 유효하지 않은 release version을 거부한다', async () => {
  for (const rootVersion of [null, 'release-1', '1.0.0-01']) {
    await withWorkspace({ rootVersion }, ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /root release version must be valid SemVer/);
    });
  }
});

test('동일 version의 두 공개 package 계약은 통과한다', async () => {
  await withWorkspace({}, ({ status, stdout, stderr }) => {
    assert.equal(status, 0, stderr);
    assert.match(stdout, /Package version check passed: 0\.1\.0/);
  });
});
