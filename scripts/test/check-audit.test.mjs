import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { assertAuditReport } from '../check-audit.mjs';

const zero = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };

test('모든 severity가 0이면 통과한다', () => {
  assert.doesNotThrow(() => assertAuditReport({ metadata: { vulnerabilities: zero } }, 'full'));
});

test('info advisory도 거부한다', () => {
  assert.throws(
    () => assertAuditReport({ metadata: { vulnerabilities: { ...zero, info: 1 } } }, 'full'),
    /full audit vulnerabilities: info=1/,
  );
});

test('severity metadata가 없으면 거부한다', () => {
  assert.throws(() => assertAuditReport({}, 'production'), /Invalid production audit report/);
});

test('severity count가 빠진 보고서는 거부한다', () => {
  assert.throws(
    () =>
      assertAuditReport(
        { metadata: { vulnerabilities: { ...zero, info: undefined } } },
        'production',
      ),
    /Invalid production audit report/,
  );
});

test('잘못된 audit JSON에는 exit status와 stderr를 포함한다', () => {
  const binDirectory = mkdtempSync(join(tmpdir(), 'check-audit-'));
  const fakePnpm = join(binDirectory, 'pnpm');
  writeFileSync(fakePnpm, '#!/bin/sh\nprintf not-json\nprintf registry-unavailable >&2\nexit 2\n');
  chmodSync(fakePnpm, 0o755);

  try {
    const result = spawnSync(process.execPath, ['scripts/check-audit.mjs', '--full'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDirectory}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Invalid full audit JSON \(status 2; stderr: registry-unavailable\)/,
    );
  } finally {
    rmSync(binDirectory, { recursive: true, force: true });
  }
});

test('schema가 잘못된 audit JSON에는 exit status와 stderr를 포함한다', () => {
  const binDirectory = mkdtempSync(join(tmpdir(), 'check-audit-'));
  const fakePnpm = join(binDirectory, 'pnpm');
  writeFileSync(
    fakePnpm,
    `#!/bin/sh
printf '%s' '{"metadata":{}}'
printf schema-invalid >&2
exit 2
`,
  );
  chmodSync(fakePnpm, 0o755);

  try {
    const result = spawnSync(process.execPath, ['scripts/check-audit.mjs', '--full'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDirectory}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid full audit report \(status 2; stderr: schema-invalid\)/);
  } finally {
    rmSync(binDirectory, { recursive: true, force: true });
  }
});

test('nonzero advisory JSON은 일반 status 오류보다 severity를 먼저 보고한다', () => {
  const binDirectory = mkdtempSync(join(tmpdir(), 'check-audit-'));
  const fakePnpm = join(binDirectory, 'pnpm');
  writeFileSync(
    fakePnpm,
    `#!/bin/sh
printf '%s' '{"metadata":{"vulnerabilities":{"info":1,"low":0,"moderate":0,"high":0,"critical":0}}}'
printf advisory-present >&2
exit 1
`,
  );
  chmodSync(fakePnpm, 0o755);

  try {
    const result = spawnSync(process.execPath, ['scripts/check-audit.mjs', '--full'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDirectory}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /full audit vulnerabilities: info=1/);
    assert.doesNotMatch(result.stderr, /pnpm audit failed with/);
  } finally {
    rmSync(binDirectory, { recursive: true, force: true });
  }
});
