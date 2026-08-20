# 제품 구현 로드맵

- 관리 방식: 수동 편집
- 진행 상태 기준: `cp949/simple-html-editor`의 GitHub Issues
- 제품 계약: `docs/specs/20260820-04-editor-feature-requirements-design.md`
- 기반 설계: `docs/specs/20260820-02-html-editor-design.md`
- 검증 기준: `docs/specs/20260820-03-dependency-upgrade-design.md`

## 1. 책임

이 문서는 승인된 예정 기능을 독립 검토 가능한 작업 단위로 나누고 구현 순서와 차단 관계를 정한다. 기능 상태, 담당자와 실행 체크리스트는 GitHub Issues에서 관리하고 이 문서에 복제하지 않는다. 파일별 구현 단계와 테스트 명령은 해당 작업을 시작할 때 `docs/plans/`에 작성한다.

예정 기능의 구현이나 Issue 종료만으로 제품 계약의 상태를 변경하지 않는다. 자동 검증, 필요한 Human test와 사용자 승인을 모두 마친 뒤 제품 기능 계약을 갱신한다.

## 2. 공통 제약

모든 작업은 다음 계약을 유지한다.

- 공개 interface는 `HtmlEditor`, `HtmlEditorProps`와 `HtmlEditorHandle.focus()`로 제한한다.
- 공개 타입에 Tiptap과 ProseMirror 타입을 노출하지 않는다.
- 저장 결과는 정규화 HTML이며 편집기 DOM이나 별도 이미지 상태를 저장하지 않는다.
- `readOnly`에서는 모든 문서 변경 control과 이미지 상호작용을 차단한다.
- React 18.3과 React 19, Chrome 85 이상, SSR-safe import를 유지한다.
- 공개 `dist`는 `index.js`, `index.d.ts`, `styles.css`, `package.json` 네 파일만 포함한다.
- React와 ReactDOM만 peer dependency로 노출한다.
- production/full audit의 모든 severity 0과 승인된 라이선스 allowlist를 유지한다.
- 보류 기능은 제품 기능 계약에서 예정 기능으로 승격되기 전에는 이 로드맵에 추가하지 않는다.

## 3. 이미지 표현 고정 결정

이미지 drag resize와 가로 정렬은 같은 저장 표현을 사용한다. 세부 구현 설계는 R2에서 문서화하되 다음 결정은 변경하지 않는다.

내부 image node는 `src`, `alt`, `width`, `alignment` 의미만 가진다.

```ts
type ImageAlignment = 'left' | 'center' | 'right';

type ImagePresentation = {
  src: string;
  alt: string | null;
  width: number | null;
  alignment: ImageAlignment;
};
```

정규화 HTML은 wrapper 없이 `<img>` 하나를 사용한다. 조정한 너비는 `width` attribute에 저장하고 `height`는 저장하지 않는다. 원본 가로세로 비율, 편집 영역 폭 제한과 정렬은 다음 style allowlist로 표현한다.

```html
<!-- 원본 크기, 왼쪽 -->
<img src="https://cdn.example.com/image.png" alt="대표 이미지" style="display: block; max-width: 100%; height: auto; margin-left: 0; margin-right: auto">

<!-- 320px, 가운데 -->
<img src="https://cdn.example.com/image.png" alt="대표 이미지" width="320" style="display: block; max-width: 100%; height: auto; margin-left: auto; margin-right: auto">

<!-- 320px, 오른쪽 -->
<img src="https://cdn.example.com/image.png" alt="대표 이미지" width="320" style="display: block; max-width: 100%; height: auto; margin-left: auto; margin-right: 0">
```

- `width`는 `1..10000` 범위의 ASCII 양의 정수만 읽고 출력한다.
- drag resize control의 최소 너비는 32px, 최대 너비는 현재 편집 영역의 가로폭이다.
- 정렬은 `margin-left`와 `margin-right`의 `0/auto`, `auto/auto`, `auto/0` 조합만 허용한다.
- `display`, `max-width`와 `height`는 각각 `block`, `100%`, `auto`로 정규화한다.
- 잘못된 너비는 제거하고, 잘못된 정렬은 왼쪽으로 정규화한다.
- 지원하지 않는 image attribute와 style은 제거한다. 위험한 `src`는 기존 정책대로 image node 전체를 거부한다.
- attribute 순서, style 선언 순서와 공백은 저장 계약이 아니다.

## 4. 구현 순서

### R1. 루트 demo 실행 경로

**목표:** 저장소 루트에서 `pnpm demo` 한 명령으로 기존 demo 개발 서버를 실행한다.

**선행 작업:** 없음

**범위:**

- root `package.json`에 demo workspace의 `dev` script를 호출하는 진입점을 추가한다.
- 기존 `pnpm dev`, demo build와 demo test 동작을 바꾸지 않는다.
- 이후 예정 기능의 대표 Human test 시나리오는 해당 기능 작업에서 demo에 함께 추가한다.

**완료 조건:**

- `pnpm demo`가 `@cp949/editor-simple-demo` 개발 서버를 시작한다.
- demo build와 기존 저장 HTML 불러오기 → 편집 → 저장 → 재조회 테스트가 통과한다.
- 제품 기능 계약 7장의 `pnpm demo` 항목을 충족한다.

### R2. 이미지 표현 기능 설계

**목표:** R3~R5가 공유할 HTML 정규화, editor DOM과 상호작용 계약을 하나의 승인 spec으로 확정한다.

**선행 작업:** R1

**산출물:** `docs/specs/20260820-05-image-presentation-design.md`

**범위:**

- 이 문서 3장의 고정 결정을 image node parse/render 규칙으로 구체화한다.
- 저장 HTML과 resize NodeView DOM을 분리하고 각 책임을 정한다.
- 이미지 선택, resize handle 표시, pointer lifecycle, 편집 영역 clamp와 `readOnly` 전환 규칙을 정한다.
- 이미지 정렬 command, 활성 상태와 disabled 상태의 내부 interface를 정한다.
- Chrome 85, SSR, HTML 안전성, unit/integration/E2E/Human test 기준을 정한다.

**완료 조건:**

- spec에 미결정 표현이나 구현 선택지가 남아 있지 않다.
- R3, R4와 R5가 서로 다른 파일을 변경하더라도 같은 image node attribute를 사용한다.
- 사용자 검토 후 spec 상태가 `approved`다.

### R3. 이미지 HTML 정규화

**목표:** 외부 저장 HTML과 정규화 HTML 사이에서 이미지 너비와 정렬 의미를 안전하게 보존한다.

**선행 작업:** R2

**범위:**

- private `core`의 image schema와 HTML policy에 `width`와 `alignment`를 추가한다.
- 이 문서 3장의 attribute/style allowlist와 fallback을 구현한다.
- `src`와 `alt`의 기존 안전성 및 빈 문서 판정 계약을 유지한다.
- raw 외부 HTML → editor document → 정규화 HTML → 재조회 round-trip을 검증한다.

**완료 조건:**

- 왼쪽·가운데·오른쪽 정렬과 조정 전·후 너비 조합이 정규화 후 재현된다.
- 잘못된 width, height, margin과 임의 style은 문서 실행 가능성을 늘리지 않고 제거된다.
- 이미지 정렬이나 너비 변경이 `src`와 `alt`를 변경하지 않는다.
- `core` 대상 test, typecheck와 package boundary 검사가 통과한다.

### R4. 이미지 drag resize

**목표:** 선택한 이미지의 표시 너비를 pointer drag로 조절하고 정규화 HTML만으로 복원한다.

**선행 작업:** R3

**범위:**

- 선택된 이미지에만 resize handle을 표시하는 private NodeView adapter를 구현한다.
- drag 중 원본 가로세로 비율과 32px 최소 너비를 유지하고 편집 영역 가로폭에서 clamp한다.
- drag 완료 시 image node의 `width`만 commit하고 `height`나 editor DOM wrapper를 저장하지 않는다.
- `readOnly` 초기값과 동적 전환에서 handle과 resize 동작을 차단한다.
- demo에 이미지 선택 → resize → 저장 → 재조회 시나리오를 추가한다.

**완료 조건:**

- 선택되지 않은 이미지와 `readOnly` 이미지에는 handle이 표시되지 않는다.
- 너비를 늘리는 drag와 줄이는 drag가 같은 크기 규칙을 지킨다.
- 편집 영역보다 큰 이미지와 drag 결과가 영역을 넘지 않는다.
- 저장·재조회 후 너비와 원본 가로세로 비율이 유지된다.
- pointer 취소, unmount와 `readOnly` 전환 후 늦은 이벤트가 문서를 변경하지 않는다.

### R5. 이미지 가로 정렬

**목표:** 선택한 이미지를 왼쪽·가운데·오른쪽으로 정렬하고 현재 상태를 toolbar에 표시한다.

**선행 작업:** R4

**범위:**

- 이미지 selection에서만 실행 가능한 세 정렬 command를 toolbar에 연결한다.
- 현재 `alignment`를 pressed 상태로 표시하고 이미지 밖에서는 control을 비활성화한다.
- NodeView adapter가 editor DOM의 정렬을 갱신하되 저장 HTML 표현은 R3의 정규화 module이 소유한다.
- 정렬 변경 시 `src`, `alt`와 `width`를 보존한다.
- demo에 정렬 → 저장 → 재조회 시나리오를 추가한다.

**완료 조건:**

- 세 정렬 상태의 실행 가능 여부, pressed 상태와 `readOnly` 차단이 검증된다.
- resize 전후 어느 순서로 정렬해도 너비와 정렬이 함께 유지된다.
- 저장·재조회 후 같은 정렬로 표시된다.
- toolbar 조작 중 이미지 selection을 잃지 않는다.

### R6. Lucide toolbar 아이콘

**목표:** 최종 toolbar 작업 집합에 Lucide 아이콘과 tooltip을 적용하면서 기존 command 계약을 유지한다.

**선행 작업:** R5

**범위:**

- 작업 의미가 명확한 버튼만 아이콘 중심 표현으로 전환한다.
- 제목 단계, 글자색 native control처럼 텍스트가 더 명확한 control은 텍스트 표현을 유지한다.
- 아이콘 버튼의 접근 가능한 label, tooltip, pressed 상태와 disabled 상태를 유지한다.
- Lucide runtime을 bundle 내부에 포함하고 공개 peer dependency를 늘리지 않는다.
- demo와 toolbar 회귀 테스트를 최종 control 구성에 맞춘다.

**완료 조건:**

- 모든 아이콘 버튼을 접근 가능한 이름으로 찾을 수 있고 tooltip으로 의미를 확인할 수 있다.
- command, selection 유지, pressed와 disabled 동작이 아이콘 전환 전과 같다.
- package boundary, dist 4파일, bundle evidence, 라이선스와 production/full audit 검사가 통과한다.

### R7. 예정 기능 통합 검증

**목표:** R1~R6 결과가 기존 필수 기능과 배포 계약을 회귀시키지 않았다는 증거를 만든다.

**선행 작업:** R1~R6

**범위:**

- demo에서 이미지 resize, 이미지 정렬과 최종 toolbar의 대표 흐름을 확인한다.
- 최신 Chromium 자동 E2E와 실제 Chrome 85 Human test 결과를 구분해 기록한다.
- React 18.3·React 19 소비자, SSR import, fresh dist와 기존 HTML fixture를 재검증한다.
- production/full audit와 라이선스 보고서를 최종 dependency graph에서 다시 생성한다.

**완료 조건:**

- `pnpm verify`와 `pnpm exec playwright test`가 통과한다.
- `pnpm demo`에서 조회 → 편집 → resize/정렬 → 저장 → 재조회 흐름이 확인된다.
- 실제 Chrome 85 Human test에서 UI 파손, console error와 uncaught error가 없다.
- `docs/reviews/20260820-04-editor-feature-requirements-review.md`에 자동 검증과 Human test 증거가 구분되어 기록된다.

### R8. 제품 계약 승격

**목표:** 검증과 사용자 승인 결과를 제품 기능 계약에 반영한다.

**선행 작업:** R7과 사용자 승인

**범위:**

- 승인된 항목만 제품 기능 계약에서 `예정`에서 `필수`로 이동한다.
- `pnpm demo` 개발 지원 항목의 상태를 실제 결과에 맞게 갱신한다.
- 각 GitHub Issue에 최종 검증 증거를 연결하고 완료된 Issue를 종료한다.
- 승인되지 않은 항목은 구현 완료 여부와 관계없이 `예정` 상태로 유지한다.

**완료 조건:**

- 제품 기능 계약, review 증거와 GitHub Issue 상태가 서로 모순되지 않는다.
- 구현 완료와 제품 계약 승격이 별도 승인 단계로 남아 있다.

## 5. 차단 관계

```text
R1 demo 실행 경로
  → R2 이미지 표현 기능 설계
    → R3 이미지 HTML 정규화
      → R4 이미지 drag resize
        → R5 이미지 가로 정렬
          → R6 Lucide toolbar 아이콘
            → R7 예정 기능 통합 검증
              → R8 제품 계약 승격
```

R1과 R6은 기술적으로 이미지 schema와 독립적이지만, 이 순서는 검증 기반을 먼저 만들고 최종 toolbar control 집합이 확정된 뒤 아이콘을 한 번만 적용하기 위한 실행 순서다. R4와 R5는 같은 image node와 NodeView adapter를 변경하므로 병렬 구현하지 않는다.

## 6. Issue와 plan 생성 규칙

- R1~R8은 각각 별도 GitHub Issue로 생성한다.
- Issue는 이 문서의 작업 ID와 관련 spec 절을 링크하고 acceptance criteria만 요약한다.
- native issue dependency로 이 문서 5장의 차단 관계를 등록한다.
- 구현 Issue를 시작할 때 관련 승인 spec과 같은 날짜·번호·topic을 공유하는 `docs/plans/` 문서를 작성한다.
- 한 작업의 구현과 검증이 끝나기 전에는 다음 작업의 source 변경을 시작하지 않는다.
- commit, push, PR, publish와 배포는 각각 별도 사용자 승인 범위다.
