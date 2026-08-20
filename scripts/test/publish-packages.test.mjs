import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertPublishedDependency,
  assertReleaseVersions,
  parsePublishArguments,
} from '../publish-packages.mjs';

test('알 수 없는 인자를 거부한다', () => {
  assert.throws(() => parsePublishArguments(['--force']), /알 수 없는 인자입니다: --force/);
});

test('dry-run, skip-verify, skip-core와 otp 인자를 읽는다', () => {
  assert.deepEqual(parsePublishArguments([]), {
    dryRun: false,
    skipVerify: false,
    skipCore: false,
    otp: undefined,
  });
  assert.deepEqual(
    parsePublishArguments(['--dry-run', '--skip-verify', '--skip-core', '--otp=123456']),
    {
      dryRun: true,
      skipVerify: true,
      skipCore: true,
      otp: '123456',
    },
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
