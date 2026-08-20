import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const expectedNames = {
  core: '@cp949/simple-html-editor-core',
  react: '@cp949/simple-html-editor-react',
};
const publishGuard = 'node ../../scripts/block-source-publish.mjs';
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function readManifest(relativePath) {
  const file = path.join(root, relativePath);

  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${relativePath}: ${error.message}`);
  }
}

async function check() {
  const rootManifest = await readManifest('package.json');
  const coreManifest = await readManifest('packages/core/package.json');
  const reactManifest = await readManifest('packages/react/package.json');
  const failures = [];
  const versions = {
    root: rootManifest.version,
    core: coreManifest.version,
    react: reactManifest.version,
  };

  for (const [label, version] of Object.entries(versions)) {
    if (typeof version !== 'string' || !semverPattern.test(version)) {
      failures.push(`${label} release version must be valid SemVer: ${version}`);
    }
  }

  if (new Set(Object.values(versions)).size !== 1) {
    failures.push(
      `release versions must match: root=${versions.root}, core=${versions.core}, react=${versions.react}`,
    );
  }

  for (const [label, manifest] of [
    ['core', coreManifest],
    ['react', reactManifest],
  ]) {
    if (manifest.name !== expectedNames[label]) {
      failures.push(`packages/${label} name must be ${expectedNames[label]}`);
    }
    if (manifest.private === true || manifest.publishConfig?.access !== 'public') {
      failures.push(`packages/${label} must be publishable with publishConfig.access=public`);
    }
    if (manifest.scripts?.prepublishOnly !== publishGuard) {
      failures.push(`packages/${label} prepublishOnly must block source-root publication`);
    }
  }

  if (reactManifest.dependencies?.[expectedNames.core] !== 'workspace:*') {
    failures.push('React core dependency must be workspace:*');
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }

  console.log(`Package version check passed: ${versions.root}`);
}

check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
