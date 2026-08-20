# simple-html-editor

서버 HTML을 불러와 사람이 편집하고 저장할 HTML로 돌려주는 React WYSIWYG 편집기 라이브러리다. 저장, 네트워크 요청, 재시도와 이미지 업로드는 편집기를 사용하는 애플리케이션이 소유한다.

이 저장소는 두 개의 npm 패키지를 하나의 release unit으로 배포하는 pnpm workspace다.

## 패키지

| 패키지 | 역할 | 문서 |
| --- | --- | --- |
| [`@cp949/simple-html-editor-react`](https://www.npmjs.com/package/@cp949/simple-html-editor-react) | React 18.3/19 소비자의 기본 진입점. `<HtmlEditor>`, toolbar와 기본 스타일 | [packages/react/README.md](packages/react/README.md) |
| [`@cp949/simple-html-editor-core`](https://www.npmjs.com/package/@cp949/simple-html-editor-core) | React에 의존하지 않는 HTML 정책과 extension 집합 | [packages/core/README.md](packages/core/README.md) |

## 빠른 시작

```bash
pnpm add @cp949/simple-html-editor-react react react-dom
```

```tsx
import { HtmlEditor } from '@cp949/simple-html-editor-react'
import '@cp949/simple-html-editor-react/styles.css'

export function PostEditor({ html, onHtmlChange }: {
  html: string | undefined
  onHtmlChange: (next: string | undefined) => void
}) {
  return <HtmlEditor value={html} onChange={onHtmlChange} />
}
```

props, 값 계약과 스타일 조정은 [packages/react/README.md](packages/react/README.md)에 있다. 저장 HTML과 정규화 HTML 사이의 계약은 [docs/product/html-contract.md](docs/product/html-contract.md)에 있다.

## 저장소 구조

```text
packages/core        공개 패키지. HTML 정책과 extension
packages/react       공개 패키지. React 컴포넌트와 toolbar
apps/demo            공개 export만 사용하는 수동 검증 앱
fixtures/consumer    빌드 산출물의 격리 소비 검증 (React 19)
fixtures/consumer-react18   같은 검증의 React 18 대상
e2e                  Playwright 브라우저 시나리오
scripts              배포 산출물, 라이선스와 audit 검증
docs                 설계, 제품 계약과 agent 운영 문서
```

의존 방향은 `core <- react <- demo`이며 fixtures는 빌드된 공개 패키지만 사용한다.

## 개발

요구 환경은 Node `>=22.13`과 `pnpm@11.22.0`이다.

```bash
pnpm install --frozen-lockfile
pnpm demo                 # demo 개발 서버
pnpm dev                  # 전체 workspace watch
pnpm build
pnpm test                 # Vitest 단위 테스트
pnpm exec playwright test # 브라우저 시나리오
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm verify               # 전체 검증
```

## 검증 게이트

`pnpm verify`는 다음을 순서대로 실행한다.

| 단계 | 고정하는 계약 |
| --- | --- |
| `check:biome` | 포맷과 lint |
| `build`, `typecheck` | 두 공개 패키지 빌드와 타입 |
| `test`, `check:gate-tests` | 단위 테스트와 검증 스크립트 자체 테스트 |
| `check:versions` | 루트와 두 공개 패키지의 release version 일치 |
| `check:boundaries` | 패키지 경계. React 산출물이 core를 external로 유지 |
| `check:dist` | 공개 `dist` 파일 목록, 선언 노출과 ES2019 문법 |
| `check:packages` | `npm pack` 파일 목록과 tarball 격리 소비 |
| `check:licenses` | 설치 graph, lockfile과 bundle module 근거의 라이선스 |
| `audit:prod`, `audit:full` | production graph와 전체 graph의 모든 severity 0 |

공개 `dist`의 파일 목록은 정확 일치로 고정한다.

```text
packages/core/dist    empty-document.d.ts, extensions.d.ts, html-policy.d.ts,
                      image-presentation.d.ts, index.d.ts, index.js,
                      package.json, README.md, LICENSE
packages/react/dist   index.js, index.d.ts, styles.css, package.json,
                      README.md, LICENSE
```

라이선스 허용 목록은 MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, MPL-2.0이다. 목록에 없거나 복합식인 라이선스는 자동 허용하지 않는다. `pnpm check:licenses`가 [docs/product/dependency-licenses.md](docs/product/dependency-licenses.md)를 생성한다.

## 브라우저 지원

최소 지원 버전과 JavaScript/demo build target은 Chrome 81이다. 호환성 검사는 build와 정적 검증에 포함되지만 최신 Playwright Chromium 자동화는 실제 Chrome 81 실행 증거가 아니다. Chrome 81 지원 승인은 대상 애플리케이션에서 별도 Human test가 필요하다.

## 로컬 `dist` 연결

라이브러리를 먼저 빌드하면 소비 가능한 산출물이 `packages/react/dist`에 생성된다. 소비자 `package.json`에서 이 디렉터리를 직접 연결할 수 있다.

```json
{
  "dependencies": {
    "@cp949/simple-html-editor-react": "link:<repository-root>/packages/react/dist"
  }
}
```

`<repository-root>`는 각 개발자의 checkout 위치로 교체하는 placeholder다. 이 로컬 link는 Human test 전용이며 배포 가능한 영구 의존성으로 커밋하지 않는다. 연결 뒤에도 소비자의 전역 CSS 진입점에서 `@cp949/simple-html-editor-react/styles.css`를 import해야 한다.

## 릴리스 정책

두 공개 패키지는 하나의 release unit이다. 한쪽만 변경되어도 두 패키지의 버전을 함께 올리고 항상 같은 버전으로 배포한다. React 배포 manifest는 같은 exact version의 core에 의존한다.

```text
전체 검증 -> core publish -> registry의 core version 확인 -> react publish -> 이름/버전/의존성 확인
```

npm은 두 패키지 publish를 원자적 transaction으로 제공하지 않는다. core 배포 후 React 배포가 실패하면 core version을 제거하지 않고 같은 version으로 재시도한다. 같은 version으로 완료할 수 없으면 두 패키지에 다음 version을 발급해 함께 배포하고 불완전한 version을 deprecate한다. 배포는 루트에서 `pnpm publish:npm`으로 실행한다. 두 패키지의 registry 상태와 배포·검증·확인 메뉴를 표시한다. 상세 절차와 실패 처리는 [배포 실행 절차](docs/product/release-runbook.md)에, 설계 근거는 [공개 패키지 이름과 동기 배포 설계](docs/specs/20260821-02-public-package-names-design.md)에 있다.

## 문서

| 경로 | 내용 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | agent와 기여자의 공통 운영 규칙 |
| [CONTEXT.md](CONTEXT.md) | 승인된 도메인 용어 |
| [docs/product/](docs/product/) | 현재 제품 계약, 로드맵과 생성 보고서 |
| [docs/specs/](docs/specs/) | 승인된 설계 결정 |
| [docs/agents/](docs/agents/) | 문서, 이슈 추적과 개발 흐름 규칙 |

## 라이선스

MIT. 전문은 [LICENSE](LICENSE)에 있다.

## 기여

이슈와 진행 상태는 [GitHub Issues](https://github.com/cp949/simple-html-editor/issues)에서 관리한다. 새 작업은 승인된 spec을 근거로 Issue를 만들고, 구현 중 발견한 범위 밖 작업은 `needs-triage` 라벨로 등록한다. 커밋 전에 `pnpm lint:fix && pnpm format`을 실행한다.
