import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const allowedLicenses = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'MPL-2.0',
  'MIT OR Apache-2.0',
]);
const ownedWorkspacePackages = new Set([
  '@cp949/simple-html-editor-react',
  '@cp949/simple-html-editor-core',
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseArguments(argv) {
  const options = {
    root: process.cwd(),
    metadata: undefined,
    report: undefined,
    bundleMetadata: undefined,
    lockfile: undefined,
  };
  const flags = new Set(['--root', '--metadata', '--report', '--bundle-metadata', '--lockfile']);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !flags.has(flag)) {
      throw new Error(
        'Usage: node check-licenses.mjs [--root path] [--metadata path] [--bundle-metadata path] [--lockfile path] [--report path]',
      );
    }
    const key = flag.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    options[key] = value;
  }
  options.root = path.resolve(options.root);
  options.report = path.resolve(
    options.root,
    options.report ?? 'docs/product/dependency-licenses.md',
  );
  options.bundleMetadata = path.resolve(
    options.root,
    options.bundleMetadata ?? 'packages/react/.bundle/bundle-modules.json',
  );
  options.lockfile = path.resolve(options.root, options.lockfile ?? 'pnpm-lock.yaml');
  if (options.metadata) options.metadata = path.resolve(options.root, options.metadata);
  return options;
}

function loadPnpmMetadata(root) {
  const result = spawnSync('pnpm', ['list', '--recursive', '--depth', 'Infinity', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm metadata command failed:\n${result.stderr.trim()}`);
  }
  return result.stdout;
}

function parsePnpmOptionalDependencyEdges(lockfile) {
  const optionalDependenciesBySnapshot = new Map();
  let inSnapshots = false;
  let snapshot;
  let inOptionalDependencies = false;

  for (const line of lockfile.split('\n')) {
    if (line === 'snapshots:') {
      inSnapshots = true;
      continue;
    }
    if (!inSnapshots) continue;

    const snapshotMatch = line.match(/^ {2}([^ ].+):$/);
    if (snapshotMatch) {
      snapshot = snapshotMatch[1].replace(/^['"]|['"]$/g, '');
      inOptionalDependencies = false;
      continue;
    }

    if (!snapshot) continue;
    if (/^ {4}optionalDependencies:$/.test(line)) {
      inOptionalDependencies = true;
      continue;
    }
    if (/^ {4}\S/.test(line)) {
      inOptionalDependencies = false;
      continue;
    }
    if (!inOptionalDependencies) continue;

    const dependencyMatch = line.match(/^ {6}(.+?): /);
    if (!dependencyMatch) continue;
    const dependencyName = dependencyMatch[1].replace(/^['"]|['"]$/g, '');
    const dependencies = optionalDependenciesBySnapshot.get(snapshot) ?? new Set();
    dependencies.add(dependencyName);
    optionalDependenciesBySnapshot.set(snapshot, dependencies);
  }

  return optionalDependenciesBySnapshot;
}

function isPnpmOptionalDependency(optionalDependenciesBySnapshot, node, dependencyName) {
  const parentName = node.name ?? node.from;
  if (typeof parentName !== 'string' || typeof node.version !== 'string') return false;
  const identity = `${parentName}@${node.version}`;
  for (const [snapshot, dependencies] of optionalDependenciesBySnapshot) {
    if (
      (snapshot === identity || snapshot.startsWith(`${identity}(`)) &&
      dependencies.has(dependencyName)
    ) {
      return true;
    }
  }
  return false;
}

function collectGraph(roots, optionalDependenciesBySnapshot) {
  const records = new Map();
  const visited = new Set();

  function visit(node, dependencyName) {
    if (!node || typeof node !== 'object') return undefined;
    const recordPath = typeof node.path === 'string' ? path.resolve(node.path) : undefined;
    let record;
    if (recordPath) {
      record = records.get(recordPath) ?? {
        path: recordPath,
        metadataName: node.name ?? node.from ?? dependencyName,
        dependencyPaths: new Set(),
        requiredDependencyPaths: new Set(),
        referencedByGraph: false,
        requiredByGraph: false,
      };
      records.set(recordPath, record);
    }
    if (visited.has(node)) return record;
    visited.add(node);

    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, dependency] of Object.entries(node[section] ?? {})) {
        const dependencyRecord = visit(dependency, name);
        if (record && dependencyRecord) {
          record.dependencyPaths.add(dependencyRecord.path);
          // optional edge는 현재 플랫폼에서 설치되지 않을 수 있으므로 required edge와 구분한다.
          if (
            section !== 'optionalDependencies' &&
            !isPnpmOptionalDependency(optionalDependenciesBySnapshot, node, name)
          ) {
            record.requiredDependencyPaths.add(dependencyRecord.path);
          }
          dependencyRecord.referencedByGraph = true;
        }
      }
    }
    return record;
  }

  for (const root of roots) visit(root, root.name);
  markRequiredRecords(roots, records);
  return records;
}

// optional edge를 한 번도 거치지 않고 workspace root에서 도달하는 record를 표시한다.
// optional 경로로만 참조되는 package는 현재 플랫폼에서 설치되지 않을 수 있다.
function markRequiredRecords(roots, records) {
  const pending = [];
  for (const root of roots) {
    if (!root || typeof root.path !== 'string') continue;
    const record = records.get(path.resolve(root.path));
    if (record) pending.push(record);
  }
  while (pending.length > 0) {
    const record = pending.pop();
    if (record.requiredByGraph) continue;
    record.requiredByGraph = true;
    for (const dependencyPath of record.requiredDependencyPaths) {
      const dependency = records.get(dependencyPath);
      if (dependency) pending.push(dependency);
    }
  }
}

async function isExistingDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function loadGraphManifests(records) {
  for (const record of records.values()) {
    // 미설치 optional package와 깨진 설치를 구분하려면 디렉터리 존재 여부가 필요하다.
    record.directoryExists = await isExistingDirectory(record.path);
    try {
      record.manifest = JSON.parse(await readFile(path.join(record.path, 'package.json'), 'utf8'));
    } catch (error) {
      record.manifestError = error;
    }
  }
}

function parseBundleMetadata(source) {
  let metadata;
  try {
    metadata = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid bundle metadata: ${error.message}`);
  }
  if (
    metadata?.version !== 1 ||
    typeof metadata.bundle?.file !== 'string' ||
    !/^[a-f0-9]{64}$/.test(metadata.bundle?.sha256) ||
    !Array.isArray(metadata.modules) ||
    !metadata.modules.every((value) => typeof value === 'string') ||
    !Array.isArray(metadata.externalImports) ||
    !metadata.externalImports.every((value) => typeof value === 'string')
  ) {
    throw new Error('Invalid bundle metadata: expected version 1 module/import arrays');
  }
  return metadata;
}

async function verifyBundleOutput(root, bundleMetadata) {
  const bundlePath = path.isAbsolute(bundleMetadata.bundle.file)
    ? bundleMetadata.bundle.file
    : path.resolve(root, bundleMetadata.bundle.file);
  let contents;
  try {
    contents = await readFile(bundlePath);
  } catch (error) {
    throw new Error(`Cannot read bundle output ${bundleMetadata.bundle.file}: ${error.message}`);
  }
  const actualHash = createHash('sha256').update(contents).digest('hex');
  if (actualHash !== bundleMetadata.bundle.sha256) {
    throw new Error(`Bundle metadata is stale for ${bundleMetadata.bundle.file}`);
  }
}

function packageNameFromSpecifier(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function recordContainingModule(records, modulePath) {
  const absoluteModulePath = path.resolve(modulePath);
  return [...records.values()]
    .filter(
      (record) =>
        absoluteModulePath === record.path ||
        absoluteModulePath.startsWith(`${record.path}${path.sep}`),
    )
    .sort((left, right) => right.path.length - left.path.length)[0];
}

// pnpm graph edge 정보와 filesystem 사실로 audit 대상 여부를 판정한다.
// - manifest를 읽은 참조 package: 자체 workspace package만 제외한다.
// - manifest가 없어도 디렉터리가 있거나 optional이 아닌 경로로 참조되면 audit 대상이다.
//   (설치된 package의 manifest 손상, 또는 required package 미설치 = 깨진 설치)
// - optional 경로로만 참조되고 디렉터리도 없으면 현재 플랫폼 미설치 optional로 보고 제외한다.
function isAuditedRecord(record) {
  if (!record.referencedByGraph) return false;
  if (record.manifest) return !ownedWorkspacePackages.has(record.manifest.name);
  return record.directoryExists || record.requiredByGraph;
}

function selectAuditedRecords(root, records, bundleMetadata) {
  const selectedPaths = new Set();
  const bundledPaths = new Set();
  const failures = [];
  const recordsByName = new Map();

  for (const record of records.values()) {
    const name = record.manifest?.name ?? record.metadataName;
    if (!recordsByName.has(name)) recordsByName.set(name, []);
    recordsByName.get(name).push(record);
    if (isAuditedRecord(record)) selectedPaths.add(record.path);
  }

  for (const moduleId of bundleMetadata.modules) {
    const modulePath = path.isAbsolute(moduleId) ? moduleId : path.resolve(root, moduleId);
    const record = recordContainingModule(records, modulePath);
    if (!record) {
      if (modulePath.split(path.sep).includes('node_modules')) {
        failures.push(`Bundled module is absent from full pnpm graph: ${moduleId}`);
      }
      continue;
    }
    if (!ownedWorkspacePackages.has(record.manifest?.name)) {
      selectedPaths.add(record.path);
      bundledPaths.add(record.path);
    }
  }

  const publicRecord = [...records.values()].find(
    (record) => record.manifest?.name === '@cp949/simple-html-editor-react',
  );
  const directPublicDependencies = publicRecord
    ? [...publicRecord.dependencyPaths]
        .map((dependencyPath) => records.get(dependencyPath))
        .filter(Boolean)
    : [];

  const externalRoots = [];
  for (const specifier of bundleMetadata.externalImports) {
    if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
    const packageName = packageNameFromSpecifier(specifier);
    const directMatches = directPublicDependencies.filter(
      (record) => record.manifest?.name === packageName,
    );
    const matches =
      directMatches.length > 0 ? directMatches : (recordsByName.get(packageName) ?? []);
    if (matches.length === 0) {
      failures.push(`External bundle import is absent from full pnpm graph: ${packageName}`);
      continue;
    }
    externalRoots.push(...matches);
  }

  const pending = [...externalRoots];
  while (pending.length > 0) {
    const record = pending.pop();
    if (selectedPaths.has(record.path) || ownedWorkspacePackages.has(record.manifest?.name)) {
      continue;
    }
    selectedPaths.add(record.path);
    for (const dependencyPath of record.dependencyPaths) {
      const dependency = records.get(dependencyPath);
      if (dependency) pending.push(dependency);
    }
  }

  return {
    selected: [...selectedPaths].map((selectedPath) => records.get(selectedPath)),
    bundledPaths,
    failures,
  };
}

function lockfileContainsPackage(lockfile, name, version) {
  const identity = `${name}@${version}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^ {2}['"]?${identity}['"]?:`, 'm').test(lockfile);
}

function inspectSelectedPackages(selection, lockfile) {
  const packages = [];
  const failures = [...selection.failures];

  for (const record of selection.selected) {
    const manifest = record.manifest;
    if (!manifest) {
      failures.push(
        record.directoryExists
          ? `${record.path}: missing package metadata (${record.manifestError?.message ?? 'unknown error'})`
          : `${record.path}: referenced package directory is absent`,
      );
      continue;
    }
    const identity = `${manifest?.name ?? '<unknown>'}@${manifest?.version ?? '<unknown>'}`;
    if (!manifest?.name || !manifest?.version) {
      failures.push(`${identity}: missing name or version metadata`);
      continue;
    }
    if (
      record.path.split(path.sep).includes('node_modules') &&
      !lockfileContainsPackage(lockfile, manifest.name, manifest.version)
    ) {
      failures.push(`${identity}: missing from pnpm lockfile`);
      continue;
    }
    if (typeof manifest.license !== 'string' || manifest.license.trim() === '') {
      failures.push(`${identity}: missing license metadata`);
      continue;
    }

    const license = manifest.license.trim();
    packages.push({
      name: manifest.name,
      version: manifest.version,
      license,
      bundled: selection.bundledPaths.has(record.path),
    });
    if (!allowedLicenses.has(license)) failures.push(`${identity}: ${license}`);
  }

  return { packages, failures };
}

function buildReport(packages) {
  const unique = new Map();
  for (const entry of packages) {
    const key = `${entry.name}\0${entry.version}\0${entry.license}`;
    const existing = unique.get(key);
    unique.set(key, { ...entry, bundled: entry.bundled || existing?.bundled || false });
  }
  const sorted = [...unique.values()].sort(
    (left, right) =>
      compareStrings(left.name, right.name) ||
      compareStrings(left.version, right.version) ||
      compareStrings(left.license, right.license),
  );
  const rows = sorted.map(
    ({ name, version, license, bundled }) =>
      `| ${name} | ${version} | ${license} | ${bundled ? 'yes' : 'no'} |`,
  );

  return `# Dependency licenses

This report is generated by \`pnpm check:licenses\` from the full installed pnpm graph, lockfile, and the actual \`@cp949/simple-html-editor-react\` bundle module evidence.

Allowed licenses: ${[...allowedLicenses].join(', ')}.

| Package | Version | License | Bundled |
| --- | --- | --- | --- |
${rows.join('\n')}
`;
}

async function check() {
  const options = parseArguments(process.argv.slice(2));
  const [metadataSource, bundleMetadataSource, lockfile] = await Promise.all([
    options.metadata ? readFile(options.metadata, 'utf8') : loadPnpmMetadata(options.root),
    readFile(options.bundleMetadata, 'utf8'),
    readFile(options.lockfile, 'utf8'),
  ]);
  let metadata;
  try {
    metadata = JSON.parse(metadataSource);
  } catch (error) {
    throw new Error(`Invalid pnpm metadata: ${error.message}`);
  }
  if (!Array.isArray(metadata)) throw new Error('Invalid pnpm metadata: expected an array');
  if (!/^lockfileVersion:/m.test(lockfile)) {
    throw new Error('Invalid pnpm lockfile: missing lockfileVersion');
  }

  const optionalDependenciesBySnapshot = parsePnpmOptionalDependencyEdges(lockfile);
  const records = collectGraph(metadata, optionalDependenciesBySnapshot);
  await loadGraphManifests(records);
  const bundleMetadata = parseBundleMetadata(bundleMetadataSource);
  await verifyBundleOutput(options.root, bundleMetadata);
  const selection = selectAuditedRecords(options.root, records, bundleMetadata);
  const inspection = inspectSelectedPackages(selection, lockfile);
  if (inspection.packages.length === 0 && inspection.failures.length === 0) {
    throw new Error('Bundle and external runtime metadata did not select packages');
  }
  if (inspection.failures.length > 0) {
    throw new Error(`License check failed:\n${inspection.failures.join('\n')}`);
  }

  await mkdir(path.dirname(options.report), { recursive: true });
  await writeFile(options.report, buildReport(inspection.packages));
  console.log(
    `License check passed: ${inspection.packages.length} packages; report ${path.relative(options.root, options.report)}`,
  );
}

check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
