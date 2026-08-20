import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(import.meta.dirname, '..');
const corePackage = '@cp949/simple-html-editor-core';
const reactPackage = '@cp949/simple-html-editor-react';

export function parsePublishArguments(argv) {
  const options = { dryRun: false, skipVerify: false, otp: undefined };

  for (const argument of argv) {
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--skip-verify') {
      options.skipVerify = true;
      continue;
    }
    if (argument.startsWith('--otp=')) {
      options.otp = argument.slice('--otp='.length);
      continue;
    }
    throw new Error(`알 수 없는 인자입니다: ${argument}`);
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

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDirectory,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });

  if (result.error) throw result.error;

  return result;
}

function assertSuccess(result, message) {
  if (result.status === 0) return result;

  const output = [result.stdout, result.stderr]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join('\n');

  throw new Error(output ? `${message}\n${output}` : message);
}

async function readManifest(path) {
  return JSON.parse(await readFile(join(rootDirectory, path), 'utf8'));
}

// npm 2FA는 조작마다 새 코드를 요구할 수 있으므로 publish 직전에 매번 입력받는다.
async function readOneTimePassword(label, presetOtp) {
  if (presetOtp !== undefined) return presetOtp;
  if (!process.stdin.isTTY) {
    throw new Error(
      `대화형 입력이 없어 OTP를 받을 수 없습니다. --otp=<코드>를 전달하세요: ${label}`,
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await rl.question(`${label} OTP (2FA를 쓰지 않으면 그대로 Enter): `);

    return answer.trim() === '' ? undefined : answer.trim();
  } finally {
    rl.close();
  }
}

function publishArguments(directory, otp, dryRun) {
  const args = ['publish', directory, '--access', 'public'];

  if (otp !== undefined) args.push(`--otp=${otp}`);
  if (dryRun) args.push('--dry-run');

  return args;
}

async function confirmRegistryVersion(name, version) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = run('npm', ['view', `${name}@${version}`, 'version'], { capture: true });

    if (result.status === 0 && result.stdout.trim() === version) return;

    if (attempt < 5) {
      console.log(`${name}@${version} registry 반영 대기 중 (${attempt}/5)`);
      await new Promise((settle) => setTimeout(settle, 3000));
    }
  }

  throw new Error(`registry에서 ${name}@${version}을 확인하지 못했습니다.`);
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

  const status = assertSuccess(
    run('git', ['status', '--porcelain'], { capture: true }),
    'git status 확인에 실패했습니다.',
  );

  if (status.stdout.trim() !== '') {
    throw new Error(`작업 트리가 깨끗하지 않습니다. 커밋 후 배포하세요.\n${status.stdout.trim()}`);
  }

  if (options.skipVerify) {
    console.log('pnpm verify를 건너뜁니다. 직전 검증 결과에 책임이 있습니다.');
  } else {
    console.log(`${version} 배포 전 전체 검증을 실행합니다.`);
    assertSuccess(run('pnpm', ['verify']), 'pnpm verify에 실패해 배포를 중단합니다.');
  }

  const coreOtp = await readOneTimePassword(corePackage, options.otp);
  assertSuccess(
    run('npm', publishArguments('packages/core/dist', coreOtp, options.dryRun)),
    `${corePackage} 배포에 실패했습니다. registry에 반영되지 않았습니다.`,
  );

  if (options.dryRun) {
    const reactDryRunOtp = await readOneTimePassword(reactPackage, options.otp);
    assertSuccess(
      run('npm', publishArguments('packages/react/dist', reactDryRunOtp, true)),
      `${reactPackage} dry-run에 실패했습니다.`,
    );
    console.log(`dry-run 완료: ${corePackage}, ${reactPackage} @ ${version}`);
    return;
  }

  await confirmRegistryVersion(corePackage, version);
  console.log(`${corePackage}@${version} 배포를 확인했습니다.`);

  const reactOtp = await readOneTimePassword(reactPackage, options.otp);
  const reactPublish = run('npm', publishArguments('packages/react/dist', reactOtp, false));

  if (reactPublish.status !== 0) {
    throw new Error(
      [
        `${reactPackage} 배포에 실패했습니다.`,
        `${corePackage}@${version}은 이미 배포되어 있습니다. core를 제거하거나 다른 version으로 바꾸지 마세요.`,
        `같은 version으로 재시도하려면: npm publish packages/react/dist --access public --otp=<코드>`,
        '같은 version으로 완료할 수 없으면 두 패키지에 다음 version을 발급해 함께 배포하고 불완전한 version을 deprecate하세요.',
      ].join('\n'),
    );
  }

  await confirmRegistryVersion(reactPackage, version);

  const dependencies = assertSuccess(
    run('npm', ['view', `${reactPackage}@${version}`, 'dependencies', '--json'], { capture: true }),
    '배포된 React dependency 조회에 실패했습니다.',
  );
  assertPublishedDependency(JSON.parse(dependencies.stdout), version);

  console.log(`배포 완료: ${corePackage}@${version}, ${reactPackage}@${version}`);
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
