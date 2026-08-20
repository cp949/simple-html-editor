import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const checker = path.resolve('scripts/check-licenses.mjs');

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

async function createFixture(packages) {
  const root = await mkdtemp(path.join(tmpdir(), 'editor-licenses-'));
  const packageNodes = new Map();

  for (const [index, entry] of packages.entries()) {
    const packagePath = path.join(root, 'node_modules/.pnpm', `${index}`, 'package');
    await mkdir(packagePath, { recursive: true });
    const manifest = { name: entry.name, version: entry.version ?? '1.0.0' };
    if (Object.hasOwn(entry, 'license')) manifest.license = entry.license;
    await writeFile(
      path.join(packagePath, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeFile(path.join(packagePath, 'index.js'), 'export {}\n');
    packageNodes.set(entry.name, {
      from: entry.name,
      version: manifest.version,
      path: packagePath,
      dependencies: {},
    });
  }

  for (const entry of packages) {
    const node = packageNodes.get(entry.name);
    for (const dependency of entry.dependencies ?? []) {
      node.dependencies[dependency] = packageNodes.get(dependency);
    }
  }

  const nested = new Set(packages.flatMap((entry) => entry.dependencies ?? []));
  const workspaceRoot = {
    name: '@cp949/editor-simple',
    version: '0.1.0',
    path: path.join(root, 'packages/react'),
    private: true,
    dependencies: {},
    devDependencies: {},
  };
  for (const entry of packages.filter((candidate) => !nested.has(candidate.name))) {
    workspaceRoot[entry.section ?? 'dependencies'][entry.name] = packageNodes.get(entry.name);
  }
  const metadata = [workspaceRoot];
  const metadataPath = path.join(root, 'pnpm-list.json');
  const reportPath = path.join(root, 'dependency-licenses.md');
  const bundleMetadataPath = path.join(root, 'bundle-modules.json');
  const bundleFilePath = path.join(root, 'bundle.js');
  const lockfilePath = path.join(root, 'pnpm-lock.yaml');
  await mkdir(path.join(root, 'packages/react'), { recursive: true });
  await writeFile(
    path.join(root, 'packages/react/package.json'),
    `${JSON.stringify(
      {
        name: '@cp949/editor-simple',
        version: '0.1.0',
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(bundleFilePath, 'export const bundle = true\n');
  await writeFile(
    bundleMetadataPath,
    `${JSON.stringify(
      {
        version: 1,
        bundle: {
          file: bundleFilePath,
          sha256: sha256('export const bundle = true\n'),
        },
        modules: packages
          .filter((entry) => entry.bundled)
          .map((entry) => path.join(packageNodes.get(entry.name).path, 'index.js')),
        externalImports: packages
          .filter((entry) => !entry.bundled && !nested.has(entry.name))
          .map((entry) => entry.name),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    lockfilePath,
    `lockfileVersion: '9.0'\n\npackages:\n${packages
      .map((entry) => `  '${entry.name}@${entry.version ?? '1.0.0'}':\n    resolution: {}`)
      .join('\n')}\n`,
  );

  return { root, metadataPath, reportPath, bundleMetadataPath, lockfilePath };
}

function runChecker({ root, metadataPath, reportPath, bundleMetadataPath, lockfilePath }) {
  return spawnSync(
    process.execPath,
    [
      checker,
      '--root',
      root,
      '--metadata',
      metadataPath,
      '--bundle-metadata',
      bundleMetadataPath,
      '--lockfile',
      lockfilePath,
      '--report',
      reportPath,
    ],
    { encoding: 'utf8' },
  );
}

async function withFixture(packages, assertion) {
  const fixture = await createFixture(packages);
  try {
    await assertion(fixture, runChecker(fixture));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

// Production break: 승인된 라이선스와 생성 report header가 같은 정책을 표현하지 않는다.
test('승인된 라이선스 7종과 Biome 이중 라이선스 식을 report 정책과 함께 허용한다', async () => {
  const licenses = [
    'MIT',
    'ISC',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'Apache-2.0',
    '0BSD',
    'MPL-2.0',
    'MIT OR Apache-2.0',
  ];
  await withFixture(
    licenses.map((license, index) => ({ name: `allowed-${index}`, license })),
    async (fixture, { status, stdout, stderr }) => {
      assert.equal(status, 0, stderr);
      assert.match(stdout, /License check passed: 8 packages/);
      const report = await readFile(fixture.reportPath, 'utf8');
      assert.match(
        report,
        /Allowed licenses: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, MPL-2.0, MIT OR Apache-2.0\./,
      );
    },
  );
});

// Production break: copyleft, source-별도 고지, 미확인 값 또는 승인되지 않은 복합식이 허용된다.
test('금지 및 미검토 라이선스 값을 모두 거부한다', async () => {
  const licenses = [
    'GPL-3.0',
    'AGPL-3.0',
    'SSPL-1.0',
    'SEE LICENSE IN LICENSE.txt',
    'unknown',
    'Custom',
    'MIT OR ISC',
    'MIT AND Apache-2.0',
  ];
  await withFixture(
    licenses.map((license, index) => ({ name: `rejected-${index}`, license })),
    async (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      for (const license of licenses)
        assert.match(stderr, new RegExp(license.replaceAll('.', '\\.').replaceAll(' ', '\\s')));
    },
  );
});

// Production break: checker가 direct package만 읽고 transitive package의 금지 라이선스를 놓친다.
test('transitive package의 라이선스도 검사한다', async () => {
  await withFixture(
    [
      { name: 'direct-package', license: 'MIT', dependencies: ['transitive-package'] },
      { name: 'transitive-package', license: 'GPL-3.0' },
    ],
    async (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /transitive-package@1\.0\.0: GPL-3\.0/);
    },
  );
});

// Production break: 설치 package의 license metadata가 없어도 검사가 성공한다.
test('license metadata가 없는 설치 package를 거부한다', async () => {
  await withFixture(
    [{ name: 'missing-license', license: undefined }],
    async (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /missing-license@1\.0\.0: missing license metadata/);
    },
  );
});

// Production break: 재현 가능한 보고서에서 번들된 Tiptap 또는 ProseMirror package가 누락된다.
test('정렬된 보고서에 번들 Tiptap과 ProseMirror package를 기록한다', async () => {
  await withFixture(
    [
      { name: 'react', license: 'MIT' },
      { name: 'prosemirror-state', license: 'MIT', bundled: true },
      { name: '@tiptap/core', license: 'MIT', bundled: true },
    ],
    async (fixture, { status, stderr }) => {
      assert.equal(status, 0, stderr);
      const first = await readFile(fixture.reportPath, 'utf8');
      assert.match(first, /\| @tiptap\/core \| 1\.0\.0 \| MIT \| yes \|/);
      assert.match(first, /\| prosemirror-state \| 1\.0\.0 \| MIT \| yes \|/);
      assert.match(first, /\| react \| 1\.0\.0 \| MIT \| no \|/);

      const rerun = runChecker(fixture);
      assert.equal(rerun.status, 0, rerun.stderr);
      assert.equal(await readFile(fixture.reportPath, 'utf8'), first);
    },
  );
});

// Production break: production manifest closure 밖의 build dependency가 bundle에 포함돼도 license 검사를 피한다.
test('bundle evidence에 있는 build-only package의 금지 라이선스를 거부한다', async () => {
  await withFixture(
    [
      { name: 'runtime-package', license: 'MIT' },
      {
        name: 'build-only-bundled-package',
        license: 'GPL-3.0',
        section: 'devDependencies',
        bundled: true,
      },
    ],
    async (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /build-only-bundled-package@1\.0\.0: GPL-3\.0/);
    },
  );
});

// Production break: 실제 library build가 bundle module evidence를 만들지 않거나 public dist에 추가 artifact를 남긴다.
test('실제 build가 4-file dist 밖에 bundle evidence를 생성한다', async () => {
  const build = spawnSync('pnpm', ['--filter', '@cp949/editor-simple', 'build'], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr);

  const distFiles = (await readdir(path.resolve('packages/react/dist'))).sort();
  assert.deepEqual(distFiles, ['index.d.ts', 'index.js', 'package.json', 'styles.css']);

  let metadata;
  try {
    metadata = JSON.parse(
      await readFile(path.resolve('packages/react/.bundle/bundle-modules.json'), 'utf8'),
    );
  } catch (error) {
    assert.fail(`bundle metadata를 읽을 수 없습니다: ${error.message}`);
  }
  assert.equal(metadata.version, 1);
  const builtJavaScript = await readFile(path.resolve('packages/react/dist/index.js'));
  assert.ok(metadata.bundle, 'bundle metadata가 built JavaScript hash를 제공해야 합니다.');
  assert.equal(metadata.bundle.file, 'packages/react/dist/index.js');
  assert.equal(metadata.bundle.sha256, sha256(builtJavaScript));
  assert.ok(metadata.modules.some((moduleId) => moduleId.includes('@tiptap/core')));
  assert.ok(metadata.modules.some((moduleId) => moduleId.includes('prosemirror-state')));
});

async function createPnpmWorkspaceFixture({ includeForbiddenUnbundled = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'editor-pnpm-workspace-'));
  const files = {
    'package.json': {
      name: 'license-integration-root',
      private: true,
      packageManager: 'pnpm@11.22.0',
      devDependencies: includeForbiddenUnbundled
        ? { 'unbundled-forbidden-package': 'workspace:*' }
        : {},
    },
    'packages/react/package.json': {
      name: '@cp949/editor-simple',
      version: '0.1.0',
      private: true,
      dependencies: {
        '@cp949/editor-simple-core': 'workspace:*',
        'direct-package': 'workspace:*',
      },
      devDependencies: {
        'build-only-package': 'workspace:*',
        'peer-package': 'workspace:*',
      },
      peerDependencies: {
        'peer-package': '*',
      },
    },
    'packages/core/package.json': {
      name: '@cp949/editor-simple-core',
      version: '0.1.0',
      private: true,
      dependencies: {
        'workspace-package': 'workspace:*',
      },
    },
    'packages/direct/package.json': {
      name: 'direct-package',
      version: '1.0.0',
      license: 'MIT',
      dependencies: {
        'transitive-package': 'workspace:*',
      },
    },
    'packages/transitive/package.json': {
      name: 'transitive-package',
      version: '1.0.0',
      license: 'MIT',
    },
    'packages/workspace/package.json': {
      name: 'workspace-package',
      version: '1.0.0',
      license: 'MIT',
    },
    'packages/peer/package.json': {
      name: 'peer-package',
      version: '1.0.0',
      license: 'MIT',
    },
    'packages/build-only/package.json': {
      name: 'build-only-package',
      version: '1.0.0',
      license: 'MIT',
    },
    'packages/unbundled-forbidden/package.json': {
      name: 'unbundled-forbidden-package',
      version: '1.0.0',
      license: 'GPL-3.0',
    },
  };
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(contents, null, 2)}\n`);
    if (relativePath.startsWith('packages/')) {
      await mkdir(path.join(path.dirname(file), 'src'), { recursive: true });
      await writeFile(path.join(path.dirname(file), 'src/index.js'), 'export {}\n');
    }
  }

  const install = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);

  const buildOnly = await realpath(
    path.join(root, 'packages/react/node_modules/build-only-package'),
  );
  const workspacePackage = await realpath(
    path.join(root, 'packages/core/node_modules/workspace-package'),
  );
  const bundleDirectory = path.join(root, 'packages/react/.bundle');
  const distDirectory = path.join(root, 'packages/react/dist');
  await mkdir(bundleDirectory, { recursive: true });
  await mkdir(distDirectory, { recursive: true });
  await writeFile(path.join(distDirectory, 'index.js'), 'export const bundle = true\n');
  await writeFile(
    path.join(bundleDirectory, 'bundle-modules.json'),
    `${JSON.stringify(
      {
        version: 1,
        bundle: {
          file: 'packages/react/dist/index.js',
          sha256: sha256('export const bundle = true\n'),
        },
        modules: [
          path.join(buildOnly, 'src/index.js'),
          path.join(workspacePackage, 'src/index.js'),
        ],
        externalImports: ['direct-package', 'peer-package'],
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

// Production break: production command가 full pnpm graph를 읽지 않아 peer/build/workspace 경유 package를 누락한다.
test('실제 pnpm workspace에서 full dependency와 bundle discovery를 수행한다', async () => {
  const root = await createPnpmWorkspaceFixture();
  const reportPath = path.join(root, 'dependency-licenses.md');
  try {
    const result = spawnSync(process.execPath, [checker, '--root', root, '--report', reportPath], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const report = await readFile(reportPath, 'utf8');
    for (const packageName of [
      'build-only-package',
      'direct-package',
      'peer-package',
      'transitive-package',
      'workspace-package',
    ]) {
      assert.match(report, new RegExp(`\\| ${packageName.replace('/', '\\/')} \\|`));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// Production break: 설치됐지만 bundle/external evidence 밖에 있는 package의 금지 라이선스를 놓친다.
test('실제 pnpm workspace의 unbundled 설치 package도 검사한다', async () => {
  const root = await createPnpmWorkspaceFixture({ includeForbiddenUnbundled: true });
  const reportPath = path.join(root, 'dependency-licenses.md');
  try {
    const result = spawnSync(process.execPath, [checker, '--root', root, '--report', reportPath], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unbundled-forbidden-package@1\.0\.0: GPL-3\.0/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// createFixture가 만든 pnpm metadata graph를 직접 수정한 뒤 checker를 실행한다.
// bundle/external evidence로는 만들 수 없는 graph edge와 filesystem 조합을 재현한다.
async function withMutatedGraphFixture(packages, mutate, assertion) {
  const fixture = await createFixture(packages);
  try {
    const metadata = JSON.parse(await readFile(fixture.metadataPath, 'utf8'));
    await mutate(metadata, fixture);
    await writeFile(fixture.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    await assertion(fixture, runChecker(fixture));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

function graphNode(name, packagePath) {
  return { from: name, version: '1.0.0', path: packagePath };
}

// Production break: full pnpm graph의 현재 플랫폼 미설치 optional package를 audit 대상으로 오인한다.
test('선택되지 않은 미설치 optional package metadata는 요구하지 않는다', async () => {
  await withMutatedGraphFixture(
    [{ name: 'runtime-package', license: 'MIT' }],
    (metadata, fixture) => {
      metadata[0].optionalDependencies = {
        'other-platform-package': graphNode(
          'other-platform-package',
          path.join(
            fixture.root,
            'node_modules/.pnpm/other-platform-package@1.0.0/node_modules/other-platform-package',
          ),
        ),
      };
    },
    (_fixture, { status, stdout, stderr }) => {
      assert.equal(status, 0, stderr);
      assert.match(stdout, /License check passed: 1 packages/);
    },
  );
});

// Production break: pnpm 11은 optional edge도 dependencies 아래에 내보내므로 lockfile metadata를 읽지 않으면
// 현재 플랫폼에 없는 optional package를 깨진 required install로 오판한다.
test('pnpm 11 lockfile의 optional dependency는 dependencies metadata에서도 미설치를 허용한다', async () => {
  await withMutatedGraphFixture(
    [{ name: 'runtime-package', license: 'MIT' }],
    async (metadata, fixture) => {
      metadata[0].dependencies['runtime-package'].dependencies['other-platform-package'] =
        graphNode(
          'other-platform-package',
          path.join(
            fixture.root,
            'node_modules/.pnpm/other-platform-package@1.0.0/node_modules/other-platform-package',
          ),
        );
      const lockfile = await readFile(fixture.lockfilePath, 'utf8');
      await writeFile(
        fixture.lockfilePath,
        `${lockfile}\nsnapshots:\n\n  runtime-package@1.0.0:\n    optionalDependencies:\n      other-platform-package: 1.0.0\n`,
      );
    },
    (_fixture, { status, stdout, stderr }) => {
      assert.equal(status, 0, stderr);
      assert.match(stdout, /License check passed: 1 packages/);
    },
  );
});

// Production break: lockfile optional edge를 읽는 과정이 실제로 설치된 금지 package까지 audit에서 빼면 안 된다.
test('pnpm 11 optional dependency가 설치돼 있고 금지 라이선스면 거부한다', async () => {
  await withMutatedGraphFixture(
    [
      { name: 'runtime-package', license: 'MIT' },
      { name: 'installed-optional-forbidden', license: 'GPL-3.0' },
    ],
    async (metadata, fixture) => {
      const runtime = metadata[0].dependencies['runtime-package'];
      const forbidden = metadata[0].dependencies['installed-optional-forbidden'];
      delete metadata[0].dependencies['installed-optional-forbidden'];
      runtime.dependencies['installed-optional-forbidden'] = forbidden;
      const lockfile = await readFile(fixture.lockfilePath, 'utf8');
      await writeFile(
        fixture.lockfilePath,
        `${lockfile}\nsnapshots:\n\n  runtime-package@1.0.0:\n    optionalDependencies:\n      installed-optional-forbidden: 1.0.0\n`,
      );
    },
    (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /installed-optional-forbidden@1\.0\.0: GPL-3\.0/);
    },
  );
});

// Production break: 설치·참조된 package의 package.json이 사라져도 checker가 조용히 통과한다.
test('디렉터리가 존재하는 참조 package의 manifest 누락을 거부한다', async () => {
  await withMutatedGraphFixture(
    [{ name: 'runtime-package', license: 'MIT' }],
    async (metadata, fixture) => {
      const installedPath = path.join(fixture.root, 'node_modules/.pnpm/manifest-missing/package');
      await mkdir(installedPath, { recursive: true });
      metadata[0].dependencies['manifest-missing-package'] = graphNode(
        'manifest-missing-package',
        installedPath,
      );
    },
    (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(
        stderr,
        new RegExp(`manifest-missing\\${path.sep}package: missing package metadata`),
      );
    },
  );
});

// Production break: 설치·참조된 package의 package.json이 깨져도 checker가 조용히 통과한다.
test('디렉터리가 존재하는 참조 package의 invalid manifest를 거부한다', async () => {
  await withMutatedGraphFixture(
    [{ name: 'runtime-package', license: 'MIT' }],
    async (metadata, fixture) => {
      const installedPath = path.join(fixture.root, 'node_modules/.pnpm/manifest-invalid/package');
      await mkdir(installedPath, { recursive: true });
      await writeFile(path.join(installedPath, 'package.json'), '{ "name": broken\n');
      metadata[0].dependencies['manifest-invalid-package'] = graphNode(
        'manifest-invalid-package',
        installedPath,
      );
    },
    (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(
        stderr,
        new RegExp(`manifest-invalid\\${path.sep}package: missing package metadata`),
      );
    },
  );
});

// Production break: optional이 아닌 경로로 참조되는 package가 설치되지 않은 깨진 graph를 통과시킨다.
test('optional이 아닌 경로로 참조된 package 디렉터리 부재를 거부한다', async () => {
  await withMutatedGraphFixture(
    [{ name: 'runtime-package', license: 'MIT' }],
    (metadata, fixture) => {
      metadata[0].dependencies['absent-required-package'] = graphNode(
        'absent-required-package',
        path.join(fixture.root, 'node_modules/.pnpm/absent-required/package'),
      );
    },
    (_fixture, { status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(
        stderr,
        new RegExp(`absent-required\\${path.sep}package: referenced package directory is absent`),
      );
    },
  );
});
