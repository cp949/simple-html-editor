# 공개 패키지 이름과 동기 배포 설계

- 날짜: 2026-08-21
- 상태: approved
- 대상: 저장소 루트

## 1. 결정

HTML 편집기 라이브러리를 다음 두 npm 패키지로 정식 공개한다.

- `@cp949/simple-html-editor-core`
- `@cp949/simple-html-editor-react`

두 패키지는 하나의 release unit이다. 어느 한쪽만 변경되어도 두 패키지의 버전을 함께 올리고 항상 같은 버전으로 배포한다. 일반 소비자의 기본 진입점은 React 패키지이며, headless 기능이나 HTML 정책만 필요한 소비자는 core를 직접 사용할 수 있다.

이 결정은 `docs/specs/20260820-02-html-editor-design.md`의 비공개 core와 단일 공개 React 패키지 결정을 대체한다. HTML 저장 계약, 편집 기능, 브라우저 지원과 보안 정책 등 나머지 결정은 유지한다.

## 2. 목적

기존 `editor-simple` 이름은 저장소와 제품 이름인 `simple-html-editor`와 순서가 달라 패키지의 소속과 역할을 즉시 파악하기 어렵다. core와 React adapter를 모두 공개하면서 이름, 실제 package boundary와 배포 단위를 일치시킨다.

## 3. 범위

### 포함

- core와 React 공개 패키지 이름 변경
- 두 패키지의 독립적인 npm 배포 산출물
- core의 정식 공개 API와 React 공개 API 경계
- 동일 버전과 exact dependency 계약
- private demo와 consumer fixture의 workspace 이름 통일
- package boundary, dist, 라이선스와 소비 검증 갱신
- README, product 문서와 기존 spec의 패키지명 갱신

### 제외

- 실제 npm publish, tag, Git push와 배포 자동화 실행
- 기존 공개 API의 기능 변경
- HTML schema, 정규화 또는 보안 정책 변경
- React와 브라우저 지원 범위 변경
- 호환 alias 또는 deprecated 전환 패키지 배포

## 4. 패키지 구조

```text
@cp949/simple-html-editor-core
              ^
              | exact runtime dependency
@cp949/simple-html-editor-react
              ^
              |
      consumer application
```

### `@cp949/simple-html-editor-core`

React에 의존하지 않는 편집 규칙과 HTML 정책을 제공한다.

- extension 구성
- 외부 HTML 정책
- 빈 문서 판정
- 링크와 이미지 URL 정책
- 이미지 표시 정책

core의 공개 API가 사용하는 Tiptap 타입은 core 선언에서 허용한다. 공개한 symbol과 타입은 SemVer 호환성 관리 대상이다.

### `@cp949/simple-html-editor-react`

일반 소비자가 사용하는 기본 패키지다.

- `<HtmlEditor>`
- props와 imperative handle 타입
- toolbar와 React 생명주기
- 기본 스타일과 `./styles.css` export

React 패키지는 같은 버전의 core를 runtime dependency로 사용한다. React의 공개 선언에는 Tiptap과 ProseMirror 구현 타입을 노출하지 않는다. React와 ReactDOM은 기존처럼 peer dependency로 유지한다.

## 5. private workspace 이름

공개 패키지와 저장소 내부 식별자의 어휘를 통일한다.

- `@cp949/simple-html-editor-demo`
- `@cp949/simple-html-editor-consumer`
- `@cp949/simple-html-editor-consumer-react18`

이 패키지들은 `private: true`를 유지하며 npm 배포 대상이 아니다. 루트 package 이름 `simple-html-editor`도 유지한다.

## 6. 버전 계약

루트와 두 공개 package manifest는 같은 release version을 기록한다. 검증 명령은 세 version 중 하나라도 다르면 실패한다.

React의 배포 manifest에는 core dependency를 같은 exact version으로 기록한다.

```json
{
  "dependencies": {
    "@cp949/simple-html-editor-core": "0.2.0"
  }
}
```

workspace 개발에서는 pnpm workspace protocol을 사용하되, pack 결과에는 범위가 없는 정확한 버전만 허용한다. 두 패키지 중 한쪽만 변경되더라도 변경되지 않은 패키지도 같은 새 버전으로 다시 빌드하고 배포한다.

버전 증가 수준은 두 패키지 변경 중 소비자 영향이 더 큰 변경을 기준으로 결정한다. prerelease 식별자와 npm dist-tag도 두 패키지에서 동일하게 사용한다.

## 7. 빌드 산출물

두 공개 패키지는 각각 독립적인 소비용 디렉터리를 생성한다.

```text
packages/core/dist
packages/react/dist
```

core 산출물은 JavaScript, 타입 선언과 소비용 `package.json`을 포함한다. React 산출물은 JavaScript, 타입 선언, CSS와 소비용 `package.json`을 포함한다. 생성된 manifest에는 source workspace 경로 또는 `workspace:` specifier가 남아서는 안 된다.

React가 core를 runtime dependency로 사용하므로 core 구현을 React 산출물에 다시 포함하지 않는다. 두 패키지가 공유하는 Tiptap runtime의 중복 여부와 Chrome 81 호환성은 dist 검사와 격리 소비 테스트로 고정한다.

## 8. 배포 순서와 실패 처리

배포 순서는 다음으로 고정한다.

```text
전체 검증
  -> core publish
  -> npm registry의 core version 확인
  -> React publish
  -> 두 package name/version/dependency 확인
```

npm은 두 package publish를 하나의 원자적 transaction으로 제공하지 않는다. core 배포 후 React 배포가 실패하면 core version을 제거하거나 다른 version으로 바꾸지 않고 같은 version의 React 배포를 재시도한다. 같은 version으로 완료할 수 없는 결함이면 두 패키지에 다음 version을 발급해 함께 배포하고 불완전한 version은 deprecate한다.

위험도: 중간

롤백: 이미 공개된 npm version의 완전한 원자적 롤백은 보장하지 않는다. 동일 version 배포 완료 또는 두 패키지의 후속 version 배포로 복구한다.

## 9. 검증

구현 완료 조건은 다음과 같다.

1. 모든 manifest, source import, 스크립트와 문서가 새 이름을 사용한다.
2. 이 spec의 전환 배경을 제외한 manifest, source, script와 사용 문서에서 기존 패키지명이 발견되지 않는다.
3. 두 공개 package version이 루트 release version과 같다.
4. React pack 결과가 같은 exact version의 core에 의존한다.
5. 각 패키지의 `npm pack --dry-run` 파일 목록이 allowlist와 일치한다.
6. 빈 임시 프로젝트에서 core tarball만 설치해 ESM import와 타입 검사를 통과한다.
7. React tarball과 core tarball을 함께 설치해 ESM import, 타입 선언, CSS export와 SSR import를 검증한다.
8. React 18과 React 19 consumer fixture의 typecheck, build와 runtime 검증을 통과한다.
9. package boundary, dist, audit와 라이선스 검사를 통과한다.
10. 기존 전체 `pnpm verify`를 통과한다.

npm registry의 `E404` 응답은 이름의 공개 사용 가능성을 확정하지 않는다. 실제 구현과 배포 준비 시 scope 권한과 두 이름의 publish 가능성을 인증된 계정으로 별도 확인한다.

## 10. 전환 정책

현재 package manifest가 `private: true`이고 비인증 npm registry 조회가 `E404`를 반환했다는 근거로, 기존 이름을 사용하는 외부 소비자가 없다고 가정한다. 구현 전에 인증된 계정으로 기존 이름의 배포 이력을 확인한다. 배포 이력이 없으면 alias, redirect 또는 deprecated 호환 패키지를 만들지 않는다. 배포 이력이 있으면 이 전환 정책을 다시 설계하고 승인받기 전에는 새 이름을 배포하지 않는다. README의 설치 명령과 import 예시는 React 패키지를 기본으로 사용한다.

```bash
pnpm add @cp949/simple-html-editor-react react react-dom
```

core 직접 사용은 별도 예제로 분리한다.

```bash
pnpm add @cp949/simple-html-editor-core
```

실제 npm publish, tag와 Git push는 이 설계의 구현 범위가 아니며 각각 별도의 명시적 승인 후 수행한다.
