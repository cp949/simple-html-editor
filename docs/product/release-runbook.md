# 배포 실행 절차

- 관리 방식: 수동 편집
- 근거 설계: `docs/specs/20260821-02-public-package-names-design.md`
- 대상: `@cp949/simple-html-editor-core`, `@cp949/simple-html-editor-react`

## 1. 책임

두 공개 패키지의 npm 배포 순서와 실패 처리를 실행 가능한 명령으로 기록한다. 배포는 사용자가 직접 수행한다.

## 2. 전제 조건

```bash
npm whoami                     # 인증 계정 확인
npm access list packages @cp949   # scope publish 권한 확인
```

`npm whoami`가 `E401`을 반환하면 `npm login` 후 다시 시작한다.

비인증 조회의 `E404`는 이름의 공개 사용 가능성을 확정하지 않는다. 인증된 계정으로 두 이름의 배포 이력이 없음을 확인한다. 배포 이력이 있으면 `docs/specs/20260821-02-public-package-names-design.md` 10장의 전환 정책을 다시 설계하고 승인받기 전에는 배포하지 않는다.

## 3. 배포 전 검증

```bash
git status --short             # 출력이 비어 있어야 한다
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify`는 build, typecheck, 단위 테스트, gate 테스트, version 일치, package boundary, dist 계약, tarball 격리 소비, 라이선스와 production/full audit을 모두 실행한다. 하나라도 실패하면 배포하지 않는다.

배포될 파일 목록을 최종 확인한다.

```bash
npm pack --dry-run packages/core/dist
npm pack --dry-run packages/react/dist
```

## 4. 버전

루트, core와 React manifest는 같은 release version을 기록한다. 한쪽만 변경되어도 두 패키지를 같은 새 version으로 함께 배포한다.

```bash
node scripts/check-package-versions.mjs
```

version을 올릴 때는 세 `package.json`의 `version`을 함께 수정하고 `pnpm verify`를 다시 실행한다. React 배포 manifest의 core dependency는 build가 같은 exact version으로 다시 기록한다.

## 5. 배포 순서

배포 단위는 source workspace가 아니라 build 산출물 디렉터리다. source에서 `npm publish`를 실행하면 `scripts/block-source-publish.mjs`가 차단한다.

```bash
npm publish packages/core/dist --access public
npm view @cp949/simple-html-editor-core@<version> version
npm publish packages/react/dist --access public
```

## 6. 배포 후 확인

```bash
npm view @cp949/simple-html-editor-core@<version> name version license dist.tarball
npm view @cp949/simple-html-editor-react@<version> name version license dependencies
```

React의 `dependencies["@cp949/simple-html-editor-core"]`가 범위 없는 같은 version인지 확인한다.

## 7. 실패 처리

npm은 두 패키지 publish를 하나의 원자적 transaction으로 제공하지 않는다.

- core 배포 후 React 배포가 실패하면 core version을 제거하거나 다른 version으로 바꾸지 않고 같은 version의 React 배포를 재시도한다.
- 같은 version으로 완료할 수 없는 결함이면 두 패키지에 다음 version을 발급해 함께 배포하고 불완전한 version을 deprecate한다.

위험도: 중간

롤백: 이미 공개된 npm version의 완전한 원자적 롤백은 보장하지 않는다. 동일 version 배포 완료 또는 두 패키지의 후속 version 배포로 복구한다.

## 8. Git tag와 push

배포가 완료된 뒤 같은 version의 tag를 만들고 push한다.

```bash
git tag -a v<version> -m "v<version>"
git push origin dev
git push origin v<version>
```
