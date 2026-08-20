import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertPublishedDependency,
  assertReleaseVersions,
  displayWidth,
  formatStatusRow,
  parsePublishArguments,
} from '../publish-packages.mjs';

test('인자가 없으면 대화형 메뉴를 선택한다', () => {
  assert.deepEqual(parsePublishArguments([]), { action: 'menu', dryRun: false });
});

test('패키지별 동작 인자와 dry-run을 읽는다', () => {
  assert.deepEqual(parsePublishArguments(['--core']), { action: 'core', dryRun: false });
  assert.deepEqual(parsePublishArguments(['--react', '--dry-run']), {
    action: 'react',
    dryRun: true,
  });
});

test('알 수 없는 인자를 거부한다', () => {
  assert.throws(() => parsePublishArguments(['--force']), /알 수 없는 인자입니다: --force/);
});

// 두 패키지를 한 동작으로 이어 배포하는 경로는 제공하지 않는다.
test('연속 배포 인자를 거부한다', () => {
  assert.throws(() => parsePublishArguments(['--both']), /알 수 없는 인자입니다: --both/);
});

test('동작 인자를 두 개 지정하면 거부한다', () => {
  assert.throws(
    () => parsePublishArguments(['--core', '--react']),
    /동작 인자는 하나만 지정합니다: core, react/,
  );
});

test('루트와 두 공개 package version 불일치를 거부한다', () => {
  assert.throws(
    () => assertReleaseVersions({ root: '0.1.0', core: '0.1.0', react: '0.1.1' }),
    /release version이 다릅니다: root=0\.1\.0, core=0\.1\.0, react=0\.1\.1/,
  );
});

test('동일한 release version을 통과시킨다', () => {
  assert.equal(assertReleaseVersions({ root: '0.2.0', core: '0.2.0', react: '0.2.0' }), '0.2.0');
});

test('한글을 두 칸으로 계산해 표시 폭을 구한다', () => {
  assert.equal(displayWidth('core'), 4);
  assert.equal(displayWidth('미배포'), 6);
  assert.equal(displayWidth('core 배포'), 9);
});

test('상태 행의 표시 폭을 한글 기준으로 맞춘다', () => {
  const rows = [formatStatusRow('core', '0.1.0', '0.1.0'), formatStatusRow('react', '0.1.0', null)];
  const marks = rows.map((row) => displayWidth(row.slice(0, row.lastIndexOf(' '))));

  assert.equal(marks[0], marks[1]);
});

test('registry 조회 실패와 배포 완료를 구분해 표시한다', () => {
  assert.match(formatStatusRow('react', '0.1.0', null), /로컬 0\.1\.0\s+registry 미배포\s+대상/);
  assert.match(formatStatusRow('core', '0.1.0', '0.1.0'), /registry 0\.1\.0\s+배포됨/);
  assert.match(formatStatusRow('core', '0.2.0', '0.1.0'), /registry 0\.1\.0\s+대상/);
});

// Production break: React가 범위 지정자나 다른 version의 core에 의존한 채 배포된다.
test('배포된 React의 core dependency가 exact version이 아니면 거부한다', () => {
  assert.throws(
    () => assertPublishedDependency({ '@cp949/simple-html-editor-core': '^0.1.0' }, '0.1.0'),
    /같은 exact version의 core에 의존하지 않습니다: \^0\.1\.0 != 0\.1\.0/,
  );
  assert.throws(
    () => assertPublishedDependency({}, '0.1.0'),
    /같은 exact version의 core에 의존하지 않습니다: undefined != 0\.1\.0/,
  );
  assert.doesNotThrow(() =>
    assertPublishedDependency({ '@cp949/simple-html-editor-core': '0.1.0' }, '0.1.0'),
  );
});
