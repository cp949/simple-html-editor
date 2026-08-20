import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(import.meta.dirname, '..');
const corePackage = '@cp949/simple-html-editor-core';
const reactPackage = '@cp949/simple-html-editor-react';

const targets = {
  core: { name: corePackage, directory: 'packages/core/dist' },
  react: { name: reactPackage, directory: 'packages/react/dist' },
};

export function parsePublishArguments(argv) {
  const options = { action: 'menu', dryRun: false };
  const actions = { '--core': 'core', '--react': 'react' };

  for (const argument of argv) {
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    const action = actions[argument];

    if (action === undefined) {
      throw new Error(`알 수 없는 인자입니다: ${argument}`);
    }
    if (options.action !== 'menu') {
      throw new Error(`동작 인자는 하나만 지정합니다: ${options.action}, ${action}`);
    }

    options.action = action;
  }

  return options;
}

export function assertReleaseVersions({ root, core, react }) {
  if (root !== core || root !== react) {
    throw new Error(`release version이 다릅니다: root=${root}, core=${core}, react=${react}`);
  }
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('release version이 비어 있습니다.');
  }

  return root;
}

export function assertPublishedDependency(dependencies, version) {
  const specifier = dependencies?.[corePackage];

  if (specifier !== version) {
    throw new Error(
      `배포된 React가 같은 exact version의 core에 의존하지 않습니다: ${specifier} != ${version}`,
    );
  }
}

// 한글은 터미널에서 두 칸을 차지하므로 code unit 길이 대신 표시 폭으로 맞춘다.
export function displayWidth(value) {
  let width = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const wide =
      (codePoint >= 0x1100 && codePoint <= 0x115f) ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60);

    width += wide ? 2 : 1;
  }

  return width;
}

function padDisplay(value, width) {
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

export function formatStatusRow(label, localVersion, registryVersion) {
  const registry = registryVersion ?? '미배포';
  const mark = registryVersion === localVersion ? '배포됨' : '대상';

  return `  ${padDisplay(label, 6)} 로컬 ${padDisplay(localVersion, 8)} registry ${padDisplay(registry, 8)} ${mark}`;
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDirectory,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });

  if (result.error) throw result.error;

  return result;
}

async function readManifest(path) {
  return JSON.parse(await readFile(join(rootDirectory, path), 'utf8'));
}

function readRegistryVersion(name) {
  const result = run('npm', ['view', name, 'version'], { capture: true });

  // 미배포와 반영 지연은 모두 조회 실패로 나타난다. 실패를 오류로 다루지 않는다.
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function publishTarget(key, version, dryRun) {
  const target = targets[key];
  const args = ['publish', target.directory, '--access', 'public'];

  if (dryRun) args.push('--dry-run');

  console.log(`\n$ npm ${args.join(' ')}`);
  const result = run('npm', args);

  if (result.status !== 0) {
    console.log(`\n${target.name} 배포에 실패했습니다.`);
    console.log(`같은 version으로 재시도하세요: npm ${args.join(' ')}`);
    console.log('이미 배포된 다른 패키지의 version은 제거하거나 바꾸지 마세요.');
    return false;
  }

  console.log(`\n${target.name}@${version} 배포 명령이 성공했습니다.`);
  console.log('registry 반영에 수 분이 걸릴 수 있습니다. 메뉴 6번으로 다시 조회하세요.');
  return true;
}

function reportPublished(version) {
  for (const key of ['core', 'react']) {
    const target = targets[key];
    const result = run('npm', ['view', `${target.name}@${version}`, 'version'], { capture: true });

    if (result.status !== 0) {
      console.log(`${target.name}@${version}: registry에서 조회되지 않습니다.`);
      continue;
    }

    console.log(`${target.name}@${version}: 배포됨`);
  }

  const dependencies = run(
    'npm',
    ['view', `${reactPackage}@${version}`, 'dependencies', '--json'],
    {
      capture: true,
    },
  );

  if (dependencies.status !== 0) {
    console.log('React dependency는 아직 조회되지 않습니다.');
    return;
  }

  try {
    assertPublishedDependency(JSON.parse(dependencies.stdout), version);
    console.log(`React가 ${corePackage}@${version}에 의존합니다.`);
  } catch (error) {
    console.log(error.message);
  }
}

function printStatus(version, registryVersions, warnings) {
  console.log(`\n=== ${corePackage.replace(/-core$/, '')} 배포 도구 · release ${version} ===`);
  console.log(formatStatusRow('core', version, registryVersions.core));
  console.log(formatStatusRow('react', version, registryVersions.react));

  for (const warning of warnings) console.log(`  경고: ${warning}`);

  console.log('');
  const items = [
    ['1', 'core 배포', 'npm publish packages/core/dist --access public'],
    ['2', 'react 배포', 'npm publish packages/react/dist --access public'],
    ['3', '두 패키지 dry-run', ''],
    ['4', '전체 검증', 'pnpm verify'],
    ['5', 'registry 상태 새로고침', ''],
    ['6', '배포 결과 확인', 'version과 React의 core dependency'],
    ['7', '빌드', 'pnpm build'],
    ['q', '종료', ''],
  ];

  for (const [key, label, detail] of items) {
    console.log(
      detail === '' ? `  ${key}) ${label}` : `  ${key}) ${padDisplay(label, 28)}${detail}`,
    );
  }
  console.log('');
}

function collectWarnings() {
  const warnings = [];
  const status = run('git', ['status', '--porcelain'], { capture: true });

  if (status.status === 0 && status.stdout.trim() !== '') {
    warnings.push('작업 트리가 깨끗하지 않습니다. 배포 산출물이 커밋 상태와 다를 수 있습니다.');
  }

  return warnings;
}

async function runMenu(version) {
  const registryVersions = {
    core: readRegistryVersion(corePackage),
    react: readRegistryVersion(reactPackage),
  };
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    for (;;) {
      printStatus(version, registryVersions, collectWarnings());
      const choice = (await rl.question('선택: ')).trim().toLowerCase();

      if (choice === 'q' || choice === '') return;

      if (choice === '1') {
        publishTarget('core', version, false);
      } else if (choice === '2') {
        publishTarget('react', version, false);
      } else if (choice === '3') {
        publishTarget('core', version, true);
        publishTarget('react', version, true);
      } else if (choice === '4') {
        run('pnpm', ['verify']);
      } else if (choice === '5') {
        registryVersions.core = readRegistryVersion(corePackage);
        registryVersions.react = readRegistryVersion(reactPackage);
      } else if (choice === '6') {
        reportPublished(version);
      } else if (choice === '7') {
        run('pnpm', ['build']);
      } else {
        console.log(`알 수 없는 선택입니다: ${choice}`);
      }
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const options = parsePublishArguments(process.argv.slice(2));
  const [rootManifest, coreManifest, reactManifest] = await Promise.all([
    readManifest('package.json'),
    readManifest('packages/core/package.json'),
    readManifest('packages/react/package.json'),
  ]);
  const version = assertReleaseVersions({
    root: rootManifest.version,
    core: coreManifest.version,
    react: reactManifest.version,
  });

  if (options.action === 'core') return void publishTarget('core', version, options.dryRun);
  if (options.action === 'react') return void publishTarget('react', version, options.dryRun);

  if (!process.stdin.isTTY) {
    throw new Error('대화형 메뉴를 쓸 수 없습니다. --core 또는 --react를 지정하세요.');
  }

  await runMenu(version);
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
