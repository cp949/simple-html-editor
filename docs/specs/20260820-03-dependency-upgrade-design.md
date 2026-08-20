# Dependency/toolchain 최신화 설계

- 날짜: 2026-08-20
- 상태: approved
- 대상: 저장소 루트

## 1. 결정

모든 외부 dependency와 toolchain을 한 번에 최신 안정 버전으로 올린다. TypeScript는 최신 dist-tag가 아니라 6.x 최신 안정 버전을 사용한다. 직접 dependency는 caret 범위로 선언하고, `packageManager`만 정확한 버전으로 고정한다.

업그레이드 후 다음 조건을 모두 만족해야 한다.

1. production dependency graph와 full dependency graph의 audit 결과가 모든 severity에서 0건이다.
2. React 18.3과 React 19를 모두 공개 지원하고 각각 실제 소비자 환경에서 검증한다.
3. 기존 공개 API, HTML round-trip, core dist 7파일·React dist 4파일 계약과 라이선스 allowlist를 유지한다.
4. 대표 소비자 애플리케이션에서 기존 편집 흐름이 동작한다.
5. 마지막 단계에서 Chrome 81이 별도 Babel·polyfill 설정 없이 UI 파손과 런타임 오류 없이 동작한다. 일부 optional 기능의 비활성화는 허용한다.

## 2. 범위

### 포함

- root와 모든 workspace manifest의 외부 dependency 버전
- `pnpm-lock.yaml`
- Node/pnpm/TypeScript/Vite/Vitest/Playwright/testing-library/Tiptap/React 개발환경
- TypeScript 6, Vite 8, Vitest 4와 최신 Tiptap에 필요한 최소 코드·설정 수정
- React 18·19 소비자 fixture와 runtime 검증
- production/full audit 명령과 최종 verify 배선
- dependency 변경에 따른 라이선스 보고서
- Chrome 81 호환성 분석, 필수 shim 또는 optional 기능의 capability gate
- 소비자 애플리케이션 smoke와 Chrome 81 Human test 체크리스트

### 제외

- npm 공개 패키지명 변경
- UI 개선, 툴바 아이콘화와 간단 모드
- 이미지 resize 등 신규 기능
- 소비자 애플리케이션의 영구 dependency 또는 소스 변경
- npm publish, Git push, tag, PR과 배포

## 3. 버전 정책

2026-08-20 조사 시점의 기준 버전은 다음과 같다. 구현 착수 시 npm registry를 다시 조회하고 같은 정책 안에서 더 최신 안정 patch/minor가 있으면 그 버전을 사용한다.

| 항목 | 정책 또는 조사 시점 버전 |
|---|---|
| Node | `>=22.13` |
| pnpm | `11.22.0`; `packageManager`는 정확한 버전 |
| TypeScript | `^6.0.3`; 7.x 사용 금지 |
| `@types/node` | Node 22 계열 최신 `^22.20.1` |
| React/ReactDOM 개발 기준 | `^19.2.8` |
| React/ReactDOM peer | `>=18.3.0 <20` |
| Vite | `^8.2.2` |
| Vitest | `^4.1.11` |
| Tiptap 전체 | `^3.30.2` |
| 기타 직접 dependency | 구현 시점의 최신 안정 버전, caret 범위 |
| workspace 내부 dependency | `workspace:*` 유지 |

`@types/node`은 npm 전체 최신이 아니라 지원 Node 하한과 일치하는 22.x 최신을 사용한다. lockfile은 caret 범위에서 실제 설치한 정확한 버전을 고정한다.

## 4. 일괄 업그레이드 방식

모든 manifest를 같은 변경 단위에서 갱신하고 lockfile을 한 번 재생성한다. 패키지별 또는 toolchain 계층별 중간 버전 커밋은 만들지 않는다. 업그레이드 후 드러난 컴파일·테스트 실패는 원인을 분리해 수정하되 dependency 버전을 임의로 이전 상태로 되돌리지 않는다.

현재 root의 Tiptap extension override는 우선 제거한다. 최신 Tiptap 설치 graph가 단일 버전으로 정렬되는지 `pnpm list`와 lockfile로 확인한다. 실제 중복이나 peer 불일치가 생길 때만 원인이 확인된 최소 override를 추가하며, Tiptap package군은 같은 버전으로 유지한다.

TypeScript 6에서 CSS side-effect import가 `TS2882`로 실패하는 문제는 이미 demo와 consumer에서 재현됐다. `noUncheckedSideEffectImports`를 끄지 않고 적용 범위가 좁은 `*.css` ambient module declaration으로 해결한다.

## 5. React 18·19 지원

공개 manifest와 생성되는 dist manifest의 peer 범위는 `>=18.3.0 <20`으로 유지한다. 기본 workspace 개발환경은 React 19 최신 안정 버전을 사용한다.

React 18.3과 React 19 소비자 fixture를 분리한다. 두 fixture는 fresh public dist만 소비하며 다음 동작을 각각 검증한다.

- package와 stylesheet import
- typecheck와 consumer build
- editor mount와 기존 HTML 표시
- 입력 후 `onChange`
- imperative `focus()`
- toolbar 기본 동작
- unmount 시 오류 없음
- React duplicate instance 없음

React 공개 `.d.ts`에는 React peer 이외에 Tiptap/ProseMirror 구현 타입을 노출하지 않는다. core 공개 `.d.ts`는 source manifest에 선언한 Tiptap 타입을 사용할 수 있다.

## 6. Audit와 라이선스

`audit:prod`는 production graph, `audit:full`은 development·peer·optional을 포함한 전체 설치 graph를 검사한다. 두 명령 모두 `--audit-level low`를 사용하고 JSON 결과의 severity별 건수를 검사한다. 최종 성공 조건은 info, low, moderate, high, critical이 모두 0인 것이다.

다음 방식은 금지한다.

- advisory ignore 또는 mute
- audit suppression 설정
- `audit fix --force`
- audit 통과만을 위한 기능 없는 dependency 추가
- 근거 없는 이전 버전 고정

취약점이 발생하면 최신 안전 버전 선택, 불필요한 dependency 제거, 최소 override, 동등 기능의 안전한 dependency 교체 순서로 해결한다. 최신 버전과 audit 0을 동시에 달성할 수 없으면 작업을 중단하고 dependency 경로, advisory, 가능한 선택지를 보고한다.

라이선스 allowlist는 MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, MPL-2.0과 Biome이 사용하는 정확한 SPDX 식 `MIT OR Apache-2.0`을 유지한다. 그 밖의 복합식을 포함한 이 목록 밖의 추가와 suppression은 하지 않는다. bundle module evidence, full pnpm graph와 lockfile을 다시 생성·검사한다.

## 7. Chrome 81 최종 단계

Chrome 81 작업은 최신 dependency 전환, 현대 브라우저 검증, React 이중 검증과 audit 0 이후 마지막에 수행한다. 최종 `verify`에는 Chrome 81 게이트를 포함하므로 완료 기준에서 제외하지 않는다.

지원 책임은 라이브러리에 있다. 사용처가 library code를 Babel/SWC로 다시 변환하거나 별도 polyfill을 설치한다는 가정은 하지 않는다. 번들에 포함된 Tiptap/ProseMirror 코드도 같은 책임 범위다.

Chrome 81의 필수 동작은 다음과 같다.

- editor mount와 기존 HTML 표시
- UI 레이아웃 유지
- 기본 텍스트 입력과 `onChange`
- `focus()`와 unmount
- console error와 uncaught error 없음

처리 우선순위는 다음과 같다.

1. 최신 bundle에서 Chrome 81에 없는 문법, built-in, DOM API와 CSS를 실제 실행 경로 기준으로 식별한다.
2. library 내부 사용이면 Chrome 81 호환 구현으로 교체한다.
3. editor 시작과 기본 편집에 필수면 전역 오염이 없는 내부 helper나 최소 shim으로 보호한다.
4. optional 기능이면 capability detection 후 해당 control을 disabled 처리하고 이유를 제공한다.
5. 전역 prototype 수정은 제거를 우선한다. 불가피하면 대안이 없다는 근거와 native/부재 환경 회귀 테스트가 필요하다.

자동 게이트는 `target: chrome81`, 최종 ES2019 syntax 변환, 필요한 built-in/DOM API가 없는 환경의 runtime smoke를 포함한다. 자동 모사는 실제 layout을 증명하지 못하므로 실제 Chrome 81 human smoke에서 UI 파손과 오류를 최종 확인한다.

## 8. 검증 순서

일괄 변경 후 검증은 원인 파악을 위해 다음 순서로 실행한다. 이 순서는 변경을 계층별로 나눈다는 의미가 아니다.

1. fresh install과 lockfile 생성
2. TypeScript 6 typecheck
3. Vite 8 build와 dist 계약
4. Vitest 4 unit/integration test
5. package boundary와 Tiptap 단일 graph 확인
6. React 18·19 consumer/type/runtime 검증
7. 라이선스 검사
8. production/full audit 0
9. 최신 Chromium Playwright
10. 소비자 애플리케이션 smoke. 기존 local link가 새 dist를 해석할 수 있을 때만 해당 working tree를 읽기 전용으로 실행한다. dependency 경로 교체가 필요하면 소비자 애플리케이션을 임의 수정하지 않고 별도 승인을 요청하거나 isolated copy를 사용한다.
11. Chrome 81 compatibility 구현과 자동 runtime smoke
12. 실제 Chrome 81 human smoke
13. frozen-lockfile 재설치 후 최종 `pnpm verify`

최종 검증은 현재의 build, typecheck, test, gate test, boundary, dist, license, production/full audit을 모두 포함하고 React 18·19와 Chrome 81 게이트를 추가한다. Node 20에서 실패하는 `scripts/test/**/*.test.mjs` glob은 Node 22 환경에서도 shell 확장에 의존하지 않도록 실제 파일 집합을 명시하는 방식으로 바로잡는다.

## 9. 실패 처리와 완료 판정

최신 dependency가 기존 공개 동작을 깨면 library 내부 seam에서 적응한다. 기존 assertion 삭제, 테스트 약화, 공개 API의 Tiptap 노출, 승인된 목록 밖 라이선스 allowlist 추가와 audit suppression으로 통과시키지 않는다.

완료 판정에는 다음 증거가 모두 필요하다.

- fresh/frozen install 성공
- `pnpm verify` 성공
- production/full audit의 info 포함 모든 severity 0
- React 18·19 fixture 성공
- core dist 정확히 7파일, React dist 정확히 4파일과 public declaration boundary 유지
- 소비자 애플리케이션의 기본 편집 흐름 확인
- Chrome 81 자동 smoke와 human smoke 통과
- 최종 Git diff와 status 확인

Chrome 85.0.4182에서 Human test의 조회 → 편집 → 저장 → 재조회가 통과했다. Chrome 81.0.4032.0에서 발견한 `react-dom_client.js`의 `??=` 구문 오류는 Chrome 81 target과 실제 dev·production bundle syntax gate로 회귀 방지한다. 수정 후 같은 Chrome 81.0.4032.0에서 demo가 오류 없이 정상 동작했다.

## 10. 참고 프로젝트

- `<tiptap3-editor-root>`: TypeScript 6, Vite 8과 CSS ambient declaration 사례를 참고한다. React 19 전용 peer와 별도 full audit 부재는 채택하지 않는다.
- `<geul-root>`: pnpm 11, Node 22, Vite 8, Vitest 4, Tiptap 3.30 조합과 package/license gate를 참고한다. TypeScript 7과 exact dependency 정책은 이번 결정과 달라 채택하지 않는다.

참고 프로젝트는 검증 항목과 호환성 패턴의 근거이며 manifest나 구현을 그대로 복사하는 템플릿이 아니다.

## 11. 위험과 롤백

위험도: 중간

주요 위험은 여러 major upgrade의 실패 원인이 한 diff에 겹치는 것, React peer 중복, 최신 Tiptap의 Chrome 81 미지원 API, audit 또는 라이선스 정책과 최신 dependency의 충돌이다.

롤백: 구현 전 commit `470387427a2570f55787726ee421be2aed39ac68`로 변경 전 상태를 식별할 수 있다. 작업 중에는 사용자 파일을 되돌리지 않고 이번 변경 파일만 대상으로 복구한다. commit, push, publish와 배포는 별도 승인 없이는 수행하지 않는다.
