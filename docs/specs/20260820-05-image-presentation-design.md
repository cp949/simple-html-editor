# 이미지 표현 기능 설계

- 날짜: 2026-08-20
- 상태: approved
- 대상: R3 이미지 HTML 정규화, R4 이미지 drag resize, R5 이미지 가로 정렬

## 1. 결정

이미지의 영속 상태는 image node의 `src`, `alt`, `width`, `alignment` 네 attribute와
wrapper 없는 저장 HTML의 `<img>` 하나로 표현한다. 공개 core 패키지의 내부 module이 image schema,
parse와 render 정책을 소유하고, `react` module은 주입된 NodeView renderer로 editor DOM과
pointer 상호작용을 소유한다.

NodeView wrapper, 선택 표시와 resize handle은 editor DOM에만 존재한다. 저장 HTML과 공개
React interface에는 포함하지 않는다. `HtmlEditor`, `HtmlEditorProps`와
`HtmlEditorHandle.focus()` 이외의 공개 interface를 추가하지 않으며 Tiptap과 ProseMirror
타입을 공개 선언에 노출하지 않는다.

## 2. 범위

### 포함

- image node attribute의 type, default와 유효성
- 외부 `<img>`의 attribute와 style parse 및 정규화 순서
- 정규화 HTML render 규칙
- 저장 HTML과 editor 전용 NodeView DOM의 분리
- 이미지 선택, resize handle과 pointer lifecycle
- 편집 영역 너비 clamp와 원본 가로세로 비율 유지
- 이미지 가로 정렬 command, active와 disabled 상태
- 초기 및 동적 `readOnly` 처리
- SSR-safe import, Chrome 85, React 18.3과 React 19 제약
- R3, R4와 R5의 자동 검증 및 Human test 책임

### 제외

- 저장·조회 API와 이미지 업로드 API
- data URL을 서버 파일로 변환하는 흐름
- 이미지별 별도 상태 저장
- 이미지 대체 텍스트 편집 UI와 삭제 전용 UI
- keyboard 기반 resize와 수치 너비 입력 UI
- 높이 변경, 비율 해제와 편집 영역 밖 resize
- 양쪽 정렬과 임의 CSS 보존
- 공개 toolbar 구성 interface
- Chrome 82 이하 지원

## 3. ImagePresentation 계약

source 수준 의미는 다음 type으로 고정한다.

```ts
type ImageAlignment = 'left' | 'center' | 'right';

type ImagePresentation = {
  src: string;
  alt: string | null;
  width: number | null;
  alignment: ImageAlignment;
};
```

| attribute | type | default | 계약 |
| --- | --- | --- | --- |
| `src` | `string` | 없음 | `isAllowedImageSrc`를 통과하는 비어 있지 않은 문자열이다. 유효하지 않으면 image node 전체를 거부한다. |
| `alt` | `string \| null` | `null` | attribute 부재는 `null`, 명시적인 `alt=""`는 빈 문자열이다. 두 상태를 구분한다. |
| `width` | `number \| null` | `null` | `null`은 원본 표시 너비다. 숫자는 `1..10000` 범위의 정수다. |
| `alignment` | `ImageAlignment` | `'left'` | 잘못되거나 판정할 수 없는 외부 정렬은 `'left'`다. |

`src`에는 유효한 default가 없다. schema가 node 생성을 위해 사용하는 nullable sentinel은
`ImagePresentation`의 유효한 상태가 아니며 parse와 render interface를 통과할 수 없다.
이미지 삽입 command도 안전한 `src` 없이는 image node를 만들지 않는다.

기존 image node의 `title`과 `height`는 제거한다. 지원하지 않는 attribute는 image node의
의미가 아니며 저장 HTML에 출력하지 않는다.

## 4. 외부 HTML parse

### 4.1 판정 순서

외부 `<img>`는 다음 순서로 읽는다.

1. `src` attribute가 존재하고 `isAllowedImageSrc`를 통과하는지 확인한다. 실패하면 다른
   attribute와 style을 읽지 않고 image node 전체를 거부한다.
2. `alt`가 없으면 `null`, 있으면 attribute 문자열을 그대로 읽는다.
3. `width` attribute를 아래 정수 규칙으로 읽는다. 실패하면 `null`로 정규화한다.
4. `style`에서 정렬 margin 조합을 읽는다. 허용 조합이 아니면 `'left'`로 정규화한다.
5. 나머지 attribute와 style 선언은 버린다.

이 순서는 위험한 `src`를 가진 node가 다른 허용 attribute를 이유로 살아남지 않게 한다.

### 4.2 width parse

`width`는 attribute 값 전체가 다음 조건을 만족할 때만 읽는다.

- ASCII 문자 `1..9`로 시작하고 뒤에 ASCII 숫자 `0..9`만 온다.
- 부호, 소수점, 지수, 단위, 선행·후행 공백과 선행 `0`이 없다.
- 10진 정수 값이 `1..10000` 범위다.

따라서 `1`, `32`, `10000`은 유효하고 `0`, `01`, `+32`, `32.0`, `32px`,
` 32 `, `10001`은 무효다. 무효 width는 image node를 제거하지 않고 `null`로 만든다.
CSS의 `width`와 `min-width`는 읽지 않는다.

### 4.3 style parse

정렬은 파싱된 CSS 선언 중 `margin-left`와 `margin-right`의 최종 유효 값으로만 판정한다.
property 이름과 keyword `auto`는 ASCII 대소문자를 구분하지 않고, CSS parser가 제거하는
주변 공백은 의미가 없다. 숫자 값은 CSS zero인 `0` 또는 그 CSSOM 정규형 `0px`만 허용한다.

| `margin-left` | `margin-right` | `alignment` |
| --- | --- | --- |
| `0` | `auto` | `'left'` |
| `auto` | `auto` | `'center'` |
| `auto` | `0` | `'right'` |

둘 중 하나가 없거나, zero가 아닌 길이, 백분율, 음수, `calc()`, CSS variable 또는 다른
조합이면 `'left'`다. CSSOM은 입력 `0`을 `0px`로 정규화하므로 둘은 같은 허용 의미다.
shorthand `margin`은 읽지 않는다. CSS declaration 목록에 두 longhand가 직접 존재할 때만
정렬을 판정한다. 중복 declaration은 브라우저 CSS parser가 선택한 최종 유효 값만 사용한다.
`!important` 여부는 저장 의미가 아니며 출력하지 않는다.

`display`, `max-width`와 `height`의 외부 값은 상태로 읽지 않는다. 이 세 property는 render
단계에서 각각 `block`, `100%`, `auto`로 생성한다. 다른 margin, position, transform,
background, event attribute, class와 `data-*`를 포함한 모든 미지원 표현은 제거한다.

## 5. 정규화 HTML render

유효한 image node는 wrapper 없는 `<img>` 하나로 출력한다.

- `src`는 항상 출력한다.
- `alt`가 `null`이면 생략한다. 빈 문자열을 포함한 string이면 출력한다.
- `width`가 `null`이면 생략한다. 숫자이면 10진 ASCII 정수로 출력한다.
- style은 `display: block`, `max-width: 100%`, `height: auto`와 alignment별 margin만
  출력한다.
- `height`, `title`, class, `data-*`, event attribute와 미지원 style은 출력하지 않는다.

alignment별 style 의미는 다음과 같다.

```html
<!-- width=null, alignment=left -->
<img src="https://cdn.example.com/image.png" alt="대표 이미지" style="display: block; max-width: 100%; height: auto; margin-left: 0; margin-right: auto">

<!-- width=320, alignment=center -->
<img src="https://cdn.example.com/image.png" alt="대표 이미지" width="320" style="display: block; max-width: 100%; height: auto; margin-left: auto; margin-right: auto">

<!-- width=320, alignment=right -->
<img src="https://cdn.example.com/image.png" alt="대표 이미지" width="320" style="display: block; max-width: 100%; height: auto; margin-left: auto; margin-right: 0">
```

attribute 순서, style declaration 순서, semicolon과 공백은 저장 계약이 아니다. parse 후
render한 결과를 다시 parse하면 네 attribute의 의미가 같아야 한다.

render 시 `src`가 유효하지 않으면 `<img>`를 출력하지 않는다. 위험한 source를 빈 `src`나
placeholder image로 바꾸지 않는다.

## 6. Module과 seam

### 6.1 core package 내부 module

core package 내부 module은 다음 구현을 한곳에 둔다.

- image attribute schema
- `src`, `width`와 alignment parse
- 정규화 HTML render
- image alignment command와 selection 판정
- 기본값과 불변식

`createHtmlEditorExtensions`는 선택적인 NodeView renderer를 받는다. renderer가 없으면
core test와 HTML 정규화에 사용하는 기본 image extension을 만들고, renderer가 있으면 같은
schema와 command에 해당 renderer만 연결한다. schema를 복제한 두 image extension을 만들지
않는다.

이 seam은 기본 core adapter와 React NodeView adapter가 함께 사용한다. Tiptap의
`NodeViewRenderer` type은 core 공개 선언에 포함될 수 있지만 React 공개
`@cp949/simple-html-editor-react` 선언에는 포함하지 않는다.

### 6.2 React NodeView adapter

`react` module은 editor DOM을 만드는 NodeView adapter를 소유한다. adapter는 현재 node,
`getPos`, editor editable 상태와 selection을 사용하고 저장 HTML serializer를 구현하지
않는다.

editor DOM은 다음 역할로 제한한다.

- 정렬과 표시 너비를 적용하는 wrapper
- `draggable=false`인 실제 `<img>`
- 선택 상태를 표시하는 editor 전용 class
- pointer resize handle

wrapper와 handle의 tag, class와 `data-*`는 private 구현이며 저장 계약이 아니다.
`editor.getHTML()`은 NodeView DOM을 직렬화하지 않고 5장의 core render 규칙을 사용한다.

## 7. 이미지 selection

editable editor에서 이미지 본체에 primary pointer를 누르면 해당 image node를
`NodeSelection`으로 선택하고 editor에 focus를 둔다. text selection, 다른 node selection과
다른 editor의 selection은 선택된 이미지로 취급하지 않는다.

선택 표시는 NodeView의 `selected` 상태와 현재 node 위치가 일치할 때만 적용한다. handle은
다음 조건을 모두 만족할 때만 표시한다.

- 현재 selection이 해당 image node의 `NodeSelection`이다.
- editor가 editable이다.
- 이미지가 load되어 0보다 큰 표시 너비를 계산할 수 있다.
- 현재 편집 영역 가로폭이 32px 이상이다.

이미지 밖을 선택하거나 외부 `value`가 node를 교체하거나 node가 삭제되면 선택 표시와
handle을 즉시 제거한다.

readOnly editor에서는 이미지 pointer가 image `NodeSelection`을 새로 만들지 않는다. 동적
`readOnly=true` 전환 시 image `NodeSelection`을 인접한 유효 selection으로 이동하고 선택
표시와 handle을 제거한다. `readOnly=false`로 돌아와도 이전 이미지 selection을 복원하지
않으며 사용자가 다시 이미지를 선택해야 한다. selection 변경은 문서 변경이 아니므로
`onChange`를 호출하지 않는다.

## 8. Drag resize lifecycle

### 8.1 시작

handle은 primary button의 단일 pointer만 받는다. 시작 시 다음 값을 drag session에 고정한다.

- `pointerId`
- image node의 시작 위치와 identity
- 이미지의 현재 렌더링 너비
- 시작 `clientX`
- 시작 전 node `width`

시작 전에 editor가 editable이고 이미지가 현재 선택되어 있으며 편집 영역 너비가 32px
이상인지 다시 검사한다. 조건이 실패하면 drag를 시작하지 않는다. 성공하면 기본 browser
동작을 막고 handle에서 `setPointerCapture(pointerId)`를 호출한다. capture에 실패하면 문서를
변경하지 않고 session을 취소한다.

### 8.2 이동과 clamp

handle은 이미지 오른쪽 가장자리를 가로로 움직인다. 후보 너비는 다음과 같다.

```text
candidate = 시작 렌더링 너비 + (현재 clientX - 시작 clientX)
```

각 `pointermove`마다 현재 ProseMirror 편집면의 실제 content 가로폭을 다시 측정한다. 후보를
`32..현재 편집 영역 가로폭`으로 clamp하고 가장 가까운 정수 px로 반올림한다. 편집 영역이
drag 중 32px보다 좁아지면 session을 취소한다.

이동 중에는 NodeView DOM의 표시 너비만 갱신한다. ProseMirror transaction,
`onChange`와 undo step을 만들지 않는다. 이미지의 `height`는 설정하지 않고
`height: auto`를 유지하므로 브라우저가 이미지 intrinsic ratio를 유지한다.

### 8.3 정상 종료

같은 `pointerId`의 `pointerup`에서 다음 조건을 모두 다시 확인한다.

- editor가 editable이다.
- `getPos`가 현재 image node를 가리킨다.
- 현재 selection이 같은 image node의 `NodeSelection`이다.
- 최종 편집 영역 너비가 32px 이상이다.

조건을 만족하면 최종 너비를 다시 clamp한 뒤 image node의 `width`만 한 transaction으로
commit한다. `src`, `alt`, `alignment`와 selection은 보존한다. 시작 node width와 최종
width가 같으면 transaction과 `onChange`를 만들지 않는다. 정상 commit은 하나의 undo
step이다.

### 8.4 취소와 cleanup

다음 사건은 commit 없이 session을 취소한다.

- `pointercancel`
- 정상 종료 전에 발생한 `lostpointercapture`
- `readOnly=true` 전환
- image node 교체 또는 삭제
- NodeView 또는 editor unmount
- 편집 영역이 32px보다 좁아짐

취소 시 DOM preview를 현재 node 상태로 되돌리고, handle이 capture를 소유하면
`releasePointerCapture`를 시도하고, 모든 session listener와 상태를 제거한다. cleanup 중
capture가 이미 해제되어 발생하는 예외는 문서 변경 없이 무시한다.

각 session은 활성 여부와 `pointerId`를 검사한다. 종료·취소·unmount된 session에 도착한
`pointermove`, `pointerup`, `pointercancel`과 `lostpointercapture`는 문서와 UI를 변경하지
않는다. 동시에 두 번째 pointer가 들어오면 첫 session을 바꾸거나 대체하지 않고 무시한다.

## 9. 이미지 alignment command

private image extension은 왼쪽·가운데·오른쪽 정렬 command와 현재 상태 판정을 제공한다.
command는 다음 조건을 모두 만족할 때만 실행 가능하다.

- editor가 editable이다.
- selection이 정확히 하나의 image node를 선택한 `NodeSelection`이다.
- 요청 alignment가 `left`, `center`, `right` 중 하나다.

실행하면 선택된 image node의 `alignment`만 변경하고 `src`, `alt`, `width`와 selection을
보존한다. 이미 같은 alignment이면 성공 가능한 no-op으로 취급하되 문서 transaction과
`onChange`는 만들지 않는다.

R5 toolbar는 이미지 전용 `이미지 왼쪽 정렬`, `이미지 가운데 정렬`, `이미지 오른쪽 정렬`
control을 제공한다.

- image `NodeSelection` 밖에서는 세 control이 모두 disabled이고 pressed가 아니다.
- image `NodeSelection`에서는 현재 alignment 하나만 pressed다.
- `readOnly`에서는 세 control이 disabled이지만 현재 image selection이 남아 있는 짧은
  전환 구간에도 잘못된 command를 실행하지 않는다.
- toolbar pointer 조작은 기존 `mousedown` selection 보존 규칙을 사용한다.
- 기존 문단 정렬 control은 image selection을 자신의 active 상태로 표시하지 않으며 image
  selection에서 실행되지 않는다.

## 10. readOnly와 외부 lifecycle

초기 `readOnly=true`에서는 NodeView가 이미지를 표시하지만 선택 표시, handle과 이미지
변경 listener를 활성화하지 않는다. toolbar image alignment control도 disabled다.

동적 `readOnly=true` 전환은 다음 순서로 처리한다.

1. 활성 drag를 commit 없이 취소한다.
2. handle과 선택 표시를 제거한다.
3. image `NodeSelection`을 인접한 유효 selection으로 이동한다.
4. editor를 non-editable로 유지한다.

외부 `value` 변경으로 NodeView가 교체되거나 제거될 때도 같은 drag cleanup을 수행한다.
unmount 후에는 pointer event, image load/error와 React state update가 문서나 분리된 DOM을
변경하지 않는다.

## 11. 호환성과 안전성

- module import 시 `window`, `document`, DOM constructor, image layout과 pointer capture에
  접근하지 않는다.
- DOM 접근은 NodeView mount, effect 또는 event handler 안에서만 수행한다.
- SSR import는 NodeView를 mount하지 않고 성공해야 한다.
- React NodeView는 React 18.3과 React 19에서 같은 lifecycle과 cleanup을 제공해야 한다.
- 구현은 Chrome 85가 지원하는 Pointer Events와 pointer capture만 사용한다.
- `Array.prototype.at`, `findLast`처럼 Chrome 85에 없는 built-in을 새 실행 경로에 사용하지
  않는다.
- `ResizeObserver` 또는 새로운 CSS 기능을 필수 계약으로 두지 않는다. 편집 영역 너비는
  pointer event 시점에 DOM layout에서 측정한다.
- 이미지 intrinsic size를 신뢰해 저장하지 않는다. 저장 상태는 width 하나이며 height와
  natural size는 저장하지 않는다.
- NodeView는 `src`를 다시 검증하지 않고 core가 승인한 node만 표시한다. 외부 HTML과
  command의 source 검증 책임은 core module 한곳에 둔다.

## 12. 테스트 책임

### R3: 이미지 HTML 정규화

`core` unit와 round-trip test가 다음을 검증한다.

- 네 attribute의 default와 valid state
- `alt` 부재, 빈 문자열과 일반 문자열 구분
- width `1`, `32`, `10000` 허용
- `0`, `01`, 부호, 소수, 단위, 공백과 `10001` 제거
- 세 margin 조합과 잘못되거나 일부만 있는 조합의 왼쪽 fallback
- shorthand, zero가 아닌 margin, CSS variable, 임의 style과 미지원 attribute 제거
- 고정 `display`, `max-width`, `height`와 alignment margin render
- 위험한 `src`의 node 전체 제거
- `src`, `alt`, `width`, `alignment` 의미의 parse/render/parse 고정점
- 기존 bitmap data URL, 외부 URL, 빈 문서와 표 회귀

R3는 React NodeView, pointer와 toolbar를 구현하지 않는다.

### R4: 이미지 drag resize

`react` integration test는 실제 Tiptap editor와 NodeView를 mount하고 DOM layout 및 pointer
capture만 제어 가능한 test adapter로 대체한다. 다음을 검증한다.

- image 선택과 선택 해제에 따른 handle 표시
- 선택되지 않은 이미지, load 전 이미지와 readOnly 이미지의 handle 부재
- 늘리기, 줄이기, 32px 최소와 현재 편집 영역 최대 clamp
- 이동 중 transaction과 `onChange` 부재, 종료 시 width 하나만 commit
- `src`, `alt`, `alignment`와 selection 보존
- 한 drag가 하나의 undo step이며 cancel은 undo step을 만들지 않음
- pointer ID 불일치와 두 번째 pointer 무시
- `pointercancel`, capture 상실, node 교체, `readOnly` 전환과 unmount cleanup
- 종료 후 late event가 문서와 분리된 DOM을 변경하지 않음

최신 Chromium E2E는 실제 pointer drag 후 저장 HTML에 width만 남고 재조회 시 같은 표시
너비와 원본 비율을 유지하는지 검증한다. demo에는 이미지 선택 → resize → 저장 → 재조회
시나리오를 추가한다.

### R5: 이미지 가로 정렬

`react` integration test는 다음을 검증한다.

- image selection에서만 세 command 실행 가능
- alignment별 pressed 상태와 image 밖 disabled 상태
- readOnly command 차단
- toolbar 조작 중 image selection 유지
- 정렬 변경 시 `src`, `alt`, `width` 보존
- resize 후 정렬과 정렬 후 resize의 동일한 최종 저장 의미
- 기존 문단 정렬 control과 이미지 정렬 상태의 분리

최신 Chromium E2E는 세 정렬의 표시, 저장과 재조회를 검증한다. demo에는 정렬 → 저장 →
재조회 및 resize와 정렬의 순서 교환 시나리오를 추가한다.

### 공통 package와 Human test

R3~R5는 각 범위의 unit/integration test 외에 typecheck, package boundary와 SSR import를
유지한다. R5 완료 시 React 18.3·React 19 consumer, fresh core dist 7파일·React dist 4파일과 Chrome 85 target
gate를 실행한다.

실제 Chrome 85 Human test는 자동화된 최신 Chromium E2E와 구분해 기록한다. 대표 흐름은
이미지 조회 → 선택 → 확대·축소 → 세 가로 정렬 → 저장 → 재조회다. 이미지가 편집 영역을
넘지 않고 원본 비율을 유지하며 console error와 uncaught error가 없어야 한다.

## 13. 작업 경계

- R3는 `core` image schema와 HTML policy만 변경한다.
- R4는 승인된 schema를 사용해 private React NodeView adapter와 resize 상호작용을 추가한다.
- R5는 같은 image node와 NodeView adapter에 alignment toolbar를 연결한다.
- R4와 R5는 같은 NodeView adapter를 변경하므로 병렬 구현하지 않는다.
- 각 작업의 source 변경 전에 승인된 이 spec과 같은 날짜·번호·topic의 plan을
  `docs/plans/`에 작성한다.
- R3~R5 구현 완료만으로 제품 기능 계약의 `예정` 항목을 `필수`로 바꾸지 않는다.
- commit, push, PR, publish와 배포는 각각 별도 사용자 승인 범위다.

## 14. 대안과 기각 근거

### Tiptap 기본 ResizableNodeView

기본 구현은 초기 도입량이 적지만 width와 height를 함께 commit하고, 현재 편집 영역 너비
clamp, 동적 readOnly 취소, image selection과 late event 계약을 이 spec대로 소유하지
못한다. roadmap의 height 미저장 결정과 충돌하므로 사용하지 않는다.

### NodeView 없는 plugin decoration

ProseMirror plugin decoration과 전역 DOM event handler로도 handle을 표시할 수 있으나
image DOM, selection, pointer session과 cleanup 책임이 여러 module에 분산된다. 저장 HTML과
editor DOM을 분리하는 이점에 비해 interface가 얕고 검증 지점이 늘어나므로 사용하지 않는다.

### 공개 resize 또는 alignment props

소비자가 resize와 정렬 구현을 주입하게 하면 Tiptap/ProseMirror 의미나 별도 상태를 공개
interface에서 알아야 한다. 공개 interface 제한과 정규화 HTML 단일 저장 계약을 깨므로
추가하지 않는다.

## 15. 위험과 롤백

위험도: 중간

주요 위험은 NodeView의 editor DOM이 저장 HTML로 누출되는 것, pointer 종료 경쟁으로 늦은
transaction이 발생하는 것, image 정렬과 기존 문단 정렬 상태가 섞이는 것, layout을 모사한
integration test가 실제 Chrome 85 동작을 과대평가하는 것이다.

롤백: R3, R4와 R5를 별도 commit으로 유지하면 마지막 승인 작업의 commit을 되돌려 이전
단계로 복구할 수 있다. 저장 HTML은 wrapper 없이 `<img>`를 유지하므로 R4 또는 R5 UI를
롤백해도 R3가 허용한 width와 alignment는 안전하게 정규화할 수 있다. 이미 저장된 width와
alignment를 제거하는 data migration은 수행하지 않는다.
