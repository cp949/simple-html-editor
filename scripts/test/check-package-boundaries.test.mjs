import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = path.resolve('scripts/check-package-boundaries.mjs');

async function createWorkspace({
  dependencies = {},
  declaration = '',
  declarations = {},
  mutateManifests,
  rootDependencies = {},
  rootDevDependencies = {},
  rootOptionalDependencies = {},
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'editor-boundaries-'));
  const manifests = {
    'packages/core': {
      name: '@cp949/simple-html-editor-core',
      private: true,
      dependencies: dependencies.core ?? {},
    },
    'packages/react': {
      name: '@cp949/simple-html-editor-react',
      dependencies: {
        '@cp949/simple-html-editor-core': 'workspace:*',
        ...(dependencies.react ?? {}),
      },
      peerDependencies: {
        react: '>=18.3.0 <20',
        'react-dom': '>=18.3.0 <20',
      },
    },
    'apps/demo': {
      name: '@cp949/simple-html-editor-demo',
      private: true,
      dependencies: {
        '@cp949/simple-html-editor-react': 'workspace:*',
        ...(dependencies.demo ?? {}),
      },
    },
    'fixtures/consumer': {
      name: '@cp949/simple-html-editor-consumer',
      private: true,
      dependencies: {
        '@cp949/simple-html-editor-react': 'workspace:*',
        ...(dependencies.consumerReact19 ?? {}),
      },
    },
    'fixtures/consumer-react18': {
      name: '@cp949/simple-html-editor-consumer-react18',
      private: true,
      dependencies: {
        '@cp949/simple-html-editor-react': 'workspace:*',
        ...(dependencies.consumerReact18 ?? {}),
      },
    },
  };

  mutateManifests?.(manifests);

  await writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: 'workspace-root',
        private: true,
        dependencies: rootDependencies,
        devDependencies: rootDevDependencies,
        optionalDependencies: rootOptionalDependencies,
      },
      null,
      2,
    )}\n`,
  );

  for (const [directory, manifest] of Object.entries(manifests)) {
    await mkdir(path.join(root, directory), { recursive: true });
    await writeFile(
      path.join(root, directory, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  const dist = path.join(root, 'packages/react/dist');
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, 'index.js'), 'export const editor = {}\n');
  await writeFile(path.join(dist, 'index.d.ts'), declaration);
  await writeFile(
    path.join(dist, 'package.json'),
    `${JSON.stringify(
      {
        name: '@cp949/simple-html-editor-react',
        types: './index.d.ts',
        exports: { '.': { types: './index.d.ts', import: './index.js' } },
      },
      null,
      2,
    )}\n`,
  );
  for (const [relativePath, source] of Object.entries(declarations)) {
    const declarationPath = path.join(dist, relativePath);
    await mkdir(path.dirname(declarationPath), { recursive: true });
    await writeFile(declarationPath, source);
  }

  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, [checker, root], {
    encoding: 'utf8',
  });
}

async function withWorkspace(options, assertion) {
  const root = await createWorkspace(options);
  try {
    await assertion(runChecker(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

// Production break: core가 공개 React 패키지에 의존해 계층 방향이 역전된다.
test('core -> react 의존성을 거부한다', async () => {
  await withWorkspace(
    {
      dependencies: {
        core: { '@cp949/simple-html-editor-react': 'workspace:*' },
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /core -> react/);
    },
  );
});

// Production break: demo가 공개 React 진입점을 건너뛰고 내부 core에 결합한다.
test('demo -> core 의존성을 거부한다', async () => {
  await withWorkspace(
    {
      dependencies: {
        demo: { '@cp949/simple-html-editor-core': 'workspace:*' },
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /demo -> core/);
    },
  );
});

// Production break: consumer가 배포 패키지 대신 비공개 core를 직접 소비한다.
test('consumer React 19 -> core 의존성을 거부한다', async () => {
  await withWorkspace(
    {
      dependencies: {
        consumerReact19: { '@cp949/simple-html-editor-core': 'workspace:*' },
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /consumerReact19 -> core/);
    },
  );
});

// Production break: 공개 선언이 번들 내부 Tiptap 타입을 다시 노출한다.
test('공개 index.d.ts의 @tiptap/core import를 거부한다', async () => {
  await withWorkspace(
    { declaration: "export type { Editor } from '@tiptap/core'\n" },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /@tiptap\/core/);
    },
  );
});

// Production break: 공개 선언이 번들 내부 ProseMirror 타입을 다시 노출한다.
test('공개 index.d.ts의 prosemirror-state import를 거부한다', async () => {
  await withWorkspace(
    { declaration: "import type { EditorState } from 'prosemirror-state'\n" },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /prosemirror-state/);
    },
  );
});

// Production break: public entry가 상대 선언을 재노출하면 그 선언의 triple-slash type reference 검사가 누락된다.
test('상대 re-export 뒤의 triple-slash Tiptap type reference를 거부한다', async () => {
  await withWorkspace(
    {
      declaration: "export type * from './secondary.js'\n",
      declarations: {
        'secondary.d.ts': '/// <reference types="@tiptap/core" />\nexport interface Secondary {}\n',
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /@tiptap\/core/);
      assert.match(stderr, /secondary\.d\.ts/);
    },
  );
});

// Production break: TypeScript import-equals 문법이 ProseMirror type을 공개 선언에 노출한다.
test('import equals require의 ProseMirror type 노출을 거부한다', async () => {
  await withWorkspace(
    {
      declaration: "import EditorState = require('prosemirror-state')\nexport { EditorState }\n",
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /prosemirror-state/);
    },
  );
});

// Production break: react -> core 필수 edge가 삭제돼도 architecture gate가 통과한다.
test('react -> core 필수 edge 누락을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        delete manifests['packages/react'].dependencies['@cp949/simple-html-editor-core'];
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /Missing package edge: react -> core/);
    },
  );
});

// Production break: demo -> react 필수 edge가 삭제돼도 architecture gate가 통과한다.
test('demo -> react 필수 edge 누락을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        delete manifests['apps/demo'].dependencies['@cp949/simple-html-editor-react'];
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /Missing package edge: demo -> react/);
    },
  );
});

// Production break: consumer -> react 필수 edge가 삭제돼도 architecture gate가 통과한다.
test('consumer React 19 -> react 필수 edge 누락을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        delete manifests['fixtures/consumer'].dependencies['@cp949/simple-html-editor-react'];
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /Missing package edge: consumerReact19 -> react/);
    },
  );
});

// Production break: React 18 consumer package 이름이 바뀌어도 architecture gate가 통과한다.
test('React 18 consumer canonical 이름 변경을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        manifests['fixtures/consumer-react18'].name = '@cp949/wrong-consumer-react18';
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /fixtures\/consumer-react18 package name/);
    },
  );
});

// Production break: React 18 consumer가 public package edge를 잃어도 architecture gate가 통과한다.
test('consumer React 18 -> react 필수 edge 누락을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        delete manifests['fixtures/consumer-react18'].dependencies[
          '@cp949/simple-html-editor-react'
        ];
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /Missing package edge: consumerReact18 -> react/);
    },
  );
});

// Production break: canonical public package 이름이 바뀌어도 checker가 변경된 이름을 신뢰한다.
test('공개 package canonical 이름 변경을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        manifests['packages/react'].name = '@cp949/renamed-editor';
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /packages\/react package name/);
      assert.match(stderr, /@cp949\/editor-simple/);
    },
  );
});

// Production break: React가 peer contract와 별개로 regular runtime dependency에 추가된다.
test('React regular dependency 이동을 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        manifests['packages/react'].dependencies.react = '18.3.1';
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /React must remain peer-only/);
    },
  );
});

// Production break: 삭제된 root 앱의 runtime dependency graph가 다시 추가된다.
test('workspace root production dependency를 거부한다', async () => {
  await withWorkspace(
    { rootDependencies: { 'dead-root-runtime': '1.0.0' } },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /Workspace root must not have production dependencies/);
      assert.match(stderr, /dead-root-runtime/);
    },
  );
});

// Production break: root optionalDependencies로 production install graph가 gate를 우회한다.
test('workspace root optional production dependency를 거부한다', async () => {
  await withWorkspace(
    { rootOptionalDependencies: { 'dead-root-optional-runtime': '1.0.0' } },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /Workspace root must not have production dependencies/);
      assert.match(stderr, /dead-root-optional-runtime/);
    },
  );
});

// Production break: workspace orchestration용 root devDependencies까지 production으로 오탐한다.
test('workspace root devDependency는 허용한다', async () => {
  await withWorkspace(
    { rootDevDependencies: { turbo: '2.10.11' } },
    ({ status, stdout, stderr }) => {
      assert.equal(status, 0, stderr);
      assert.match(stdout, /Package boundary check passed/);
    },
  );
});

// Production break: 공개 package peer contract에 미검토 peer가 추가된다.
test('React와 ReactDOM 외의 public peer를 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        manifests['packages/react'].peerDependencies.vue = '^3.0.0';
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /peer keys must be exactly react, react-dom/);
    },
  );
});

// Production break: public peer range에서 지원 대상 React 18이 제거된다.
test('React 18을 제외한 public peer range를 거부한다', async () => {
  await withWorkspace(
    {
      mutateManifests: (manifests) => {
        manifests['packages/react'].peerDependencies.react = '>=19 <20';
      },
    },
    ({ status, stderr }) => {
      assert.notEqual(status, 0);
      assert.match(stderr, /react peer range must be >=18\.3\.0 <20/);
    },
  );
});

// Production break: 허용된 react -> core, demo -> react, consumer -> react 그래프를 checker가 오탐한다.
test('허용된 패키지 의존성 방향은 통과한다', async () => {
  await withWorkspace({}, ({ status, stdout, stderr }) => {
    assert.equal(status, 0, stderr);
    assert.match(stdout, /Package boundary check passed/);
  });
});
