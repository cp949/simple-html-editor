# 재사용 가능한 HTML 에디터 설계

- 날짜: 2026-08-20
- 상태: approved

## 1. 목적

이 저장소의 목표는 기존 HTML 편집기를 대체할 재사용 가능한 React WYSIWYG HTML 에디터를 만드는 것이다.

교체 이유는 다음과 같다.

- 기존 에디터 의존성에서 발생하는 `pnpm audit` 문제를 줄인다.
- 승인된 라이선스 allowlist 밖의 의존성을 제거한다.
- 서버에 저장된 기존 HTML을 불러와 편집하고 다시 HTML로 저장한다.
- 로컬 빌드 결과를 소비자 애플리케이션에 직접 연결해 Human test를 수행한다.

장기적으로 범용 에디터로 확장할 수 있게 모듈을 나누되, 1차 완료 기준은 React 18 소비자 애플리케이션의 기존 편집기 교체 가능성이다.

## 2. 확인된 소비자 계약

기존 소비자 구현의 공통 데이터 계약은 HTML 문자열이다.

- 서버에서 받은 HTML을 `content`로 전달한다.
- 사용자 편집 결과를 `onContentChange`로 받는다.
- Quill 구현은 빈 문서를 `undefined`로 전달한다.
- 일부 호출부는 에디터 준비 후 받은 인스턴스를 보관하고 포커스를 요청한다.
- CKEditor wrapper는 toolbar DOM을 외부 컨테이너로 옮기고 부모 높이를 편집 영역에 적용한다.
- Quill은 이미지, 정렬, 전경색, 배경색 등의 toolbar를 사용한다.
- 일부 저장 흐름은 HTML에 포함된 data URL 이미지를 파일로 변환한다.

소비자 호환성을 위해 React 18을 지원한다. 공식 브라우저 하한은 Chrome 85로 정한다. Chrome 82 지원은 향후 별도로 검토한다. Chrome 81.0.4032.0에서 소비자 애플리케이션의 홈 화면이 표시되지 않은 관찰은 지원 범위 밖이며 simple-html-editor 원인으로 확정하지 않는다.

## 3. 범위

### 포함

- React 18에서 사용할 수 있는 공개 React 컴포넌트
- 서버 HTML의 로드, 편집과 HTML 출력
- 외부 `value` 변경 동기화
- imperative `focus()` handle
- 에디터 상단 기본 toolbar
- 제목, 굵게, 기울임, 밑줄, 취소선
- 인용문, 글머리 목록, 번호 목록과 목록 들여쓰기
- 링크 생성·해제
- 문단 정렬
- 글자색 선택·제거
- 이미지 파일 선택과 붙여넣기
- data URL 이미지 출력
- 표 삽입과 셀 내용 편집
- 표의 행·열 추가·삭제와 표 삭제
- 안전하지 않거나 지원하지 않는 외부 HTML의 정규화
- Chrome 85 대상 빌드
- 로컬 `dist` 직접 연결
- production dependency audit와 라이선스 검사
- 소비자 애플리케이션에 연결한 Human test

### 제외

- Markdown 입출력과 미리보기 모드
- HTML 소스 편집 모드
- 서버 저장 API와 이미지 업로드 API
- 배경색 선택 UI
- 표 셀 병합·분할과 열 너비 조절
- 외부 HTML 문자열의 바이트 단위 보존
- CKEditor 또는 Quill 인스턴스 인터페이스 호환
- npm registry 배포 자동화
- Chrome 81 이하 지원

## 4. 저장소 구조

pnpm workspace와 Turborepo를 사용한다.

```text
/
├── apps/
│   └── demo/
├── fixtures/
│   └── consumer/
├── packages/
│   ├── core/
│   └── react/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

의존 방향은 다음과 같다.

```text
core <- react <- demo
          ^
          |
       consumer
```

### `packages/core`

Tiptap과 ProseMirror 기반 편집 규칙을 제공하는 공개 `@cp949/simple-html-editor-core` 패키지다.

- 허용 extension과 HTML schema
- 외부 HTML 정규화
- 빈 문서 판정
- 링크 URL 정책
- 이미지 data URL 정책
- 표 명령
- 글자색과 정렬 변환

Tiptap 타입은 공개 React 패키지의 선언 파일에 노출하지 않는다.

### `packages/react`

React UI를 제공하는 공개 `@cp949/simple-html-editor-react` 패키지다.

- `<HtmlEditor>`
- `<HtmlEditor>`의 props와 imperative handle 타입
- 기본 toolbar
- 기본 스타일과 CSS export
- React 생명주기와 외부 `value` 동기화

두 공개 패키지의 이름, 동일 버전과 동기 배포 계약은 [공개 패키지 이름과 동기 배포 설계](./20260821-02-public-package-names-design.md)를 따른다.

### `apps/demo`

라이브러리의 공개 export만 사용하는 수동 검증 앱이다. 서버 조회와 저장을 흉내 내며 제공된 `intro` HTML, 표, 이미지와 위험 HTML fixture를 전환해 볼 수 있어야 한다.

### `fixtures/consumer`

빌드된 공개 패키지를 소비자 관점에서 검증한다.

- React 18 타입 호환
- JavaScript와 타입 선언 export
- CSS export
- SSR import 안전성
- Chrome 85 빌드 target

## 5. 공개 인터페이스

```ts
export interface HtmlEditorHandle {
  focus(): void;
}

export interface HtmlEditorProps {
  value?: string;
  onChange: (html: string | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export const HtmlEditor: React.ForwardRefExoticComponent<
  HtmlEditorProps & React.RefAttributes<HtmlEditorHandle>
>;
```

저장, 알림과 재시도는 소비자가 담당한다. 에디터는 네트워크 인터페이스를 갖지 않는다.

### 빈 문서

시각적으로 빈 문서는 `onChange(undefined)`로 전달한다. 단순히 HTML 문자열이 비어 있는지만 확인하지 않고 Tiptap 문서의 텍스트와 의미 있는 노드(예: 이미지, 표)를 검사한다.

### 외부 값 동기화

- 최초 `value`는 에디터 초기값으로 사용한다.
- 부모가 새로운 서버 HTML을 전달하면 에디터를 갱신한다.
- `onChange` 결과가 부모를 통해 돌아오는 일반 리렌더에서는 selection과 undo 이력을 초기화하지 않는다.
- 완전히 다른 문서로 바꿀 때 소비자는 `key={documentId}`를 사용할 수 있다.

## 6. HTML 정규화와 안전성

HTML은 Tiptap schema가 표현할 수 있는 문서로 정규화한다.

- `<script>`, `<style>`, iframe과 실행 가능한 embed를 허용하지 않는다.
- `onclick` 등 이벤트 속성을 제거한다.
- 링크는 허용된 URI protocol만 유지한다.
- Tiptap schema가 지원하지 않는 태그는 의미 있는 텍스트만 남기거나 제거한다.
- 지원하지 않는 class, data attribute와 inline style은 제거한다.
- 문단, 제목, 목록, 인용, 링크, 이미지, 표와 지원하는 text mark는 정규형 HTML로 출력한다.
- 원본 태그 순서, 공백, 속성 순서와 wrapper 구조는 보존 계약이 아니다.

1차 구현은 별도 sanitizer 의존성을 추가하지 않고 Tiptap schema를 allowlist로 사용한다. schema만으로 충분하지 않은 링크 protocol, 이미지 source와 inline style 정책은 `core`의 parse rule에서 명시적으로 검증한다. 이 정책으로 표현할 수 없는 태그나 속성은 보존하지 않는다.

## 7. 글자색

Tiptap의 TextStyle과 Color extension으로 글자색을 표현한다.

- toolbar는 브라우저 기본 `<input type="color">`를 사용한다.
- 선택 영역에 색상을 적용하고 색상 제거 명령을 제공한다.
- 출력은 정규화된 `<span style="color: ...">` 형태를 사용한다.
- `<strong style="color: rgb(...)">`처럼 다른 mark와 같은 요소에 선언된 외부 색상도 읽을 수 있도록 제공된 `intro` HTML로 회귀 테스트한다.
- 외부 색상을 읽기 위한 추가 정규화가 필요하면 `core` 안에 숨긴다.
- 배경색은 1차 범위에서 읽기·편집·보존을 보장하지 않는다.

## 8. 이미지

- toolbar 파일 선택과 clipboard 이미지 붙여넣기를 지원한다.
- 선택한 파일은 `FileReader.readAsDataURL`로 읽어 `<img src="data:...">`로 삽입한다.
- 이미지가 존재하면 텍스트가 없어도 빈 문서로 판단하지 않는다.
- 원격 `http:`/`https:` 이미지와 `data:image/*`를 허용한다.
- SVG data URL과 실행 가능성이 있는 형식은 허용하지 않는다.
- 이미지 업로드와 data URL의 서버 파일 변환은 소비자의 저장 흐름이 담당한다.

## 9. 표

외부 HTML 표를 표시하고 편집한다.

- 외부 `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`를 읽고 행·셀과 header-cell 의미를 유지한다. 출력 wrapper는 Tiptap 정규형에 따라 달라질 수 있다.
- toolbar에서 기본 표를 삽입한다.
- 표 안에서는 행·열 추가 및 삭제, 전체 표 삭제 명령을 제공한다.
- 셀 병합·분할, `colgroup`, 복잡한 너비와 셀별 스타일은 보존 계약이 아니다.
- 표가 존재하면 텍스트가 없어도 빈 문서로 판단하지 않는다.

## 10. Toolbar와 스타일

기본 toolbar는 에디터 위에 표시되고 라이브러리가 직접 소유한다.

```text
문단/제목 | 굵게 기울임 밑줄 취소선 | 글자색 | 목록 | 인용 | 정렬 | 링크 | 이미지 | 표
```

- 활성 mark와 현재 블록 상태를 표시한다.
- toolbar 버튼의 `mousedown`이 selection을 잃게 하지 않는다.
- 키보드와 screen reader를 위한 label, pressed state와 focus 처리를 제공한다.
- MUI에 의존하지 않는다.
- 소비자는 root `className`과 CSS custom property로 높이, 색상과 테두리를 조정한다.
- 기존 toolbar DOM 이동과 특정 편집기 전용 class 의존은 제거한다.

## 11. 빌드와 패키지

`@cp949/simple-html-editor-react`는 React와 ReactDOM만 peer dependency로 두고 같은 exact version의 `@cp949/simple-html-editor-core`에 의존한다.

- peer 범위는 React 18을 포함한다.
- 각 공개 패키지의 선언된 runtime dependency와 peer dependency는 bundle에서 external로 유지한다.
- 출력 target은 Chrome 85다.
- core는 ESM JavaScript, 선언 5개와 소비용 `package.json`의 7파일을 `packages/core/dist`에 생성한다.
- React는 ESM JavaScript, `.d.ts`, CSS와 소비용 `package.json`의 4파일을 `packages/react/dist`에 생성한다.
- 두 package export는 루트 JavaScript와 타입을 제공하고 React만 `./styles.css`를 추가 제공한다.
- bundle에 포함된 모든 제3자 코드는 라이선스 보고서에 기록한다.

번들된 의존성을 공개 `dependencies`에서 숨겨 audit 결과만 깨끗하게 보이게 하는 방식은 사용하지 않는다. build-time dependency graph와 번들 구성요소를 모두 검사하고 기록한다.

## 12. Audit와 라이선스 정책

완료 조건에 다음을 포함한다.

- production dependency graph에 알려진 high/critical 취약점이 없어야 한다.
- 직접·전이·번들 의존성에 GPL, AGPL, SSPL 또는 상용 전용 라이선스가 없어야 한다. MPL-2.0은 명시적으로 승인한다.
- 허용 라이선스 목록은 정확히 `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `0BSD`, `MPL-2.0`다. 목록에 없거나 복합식으로 표시된 라이선스는 자동 허용하지 않고 사람이 패키지 원문을 검토해야 한다.
- Tiptap extension을 추가할 때 무료/MIT 패키지인지 확인한다.
- lockfile 기준 audit 결과와 라이선스 보고서를 재현할 수 있어야 한다.
- 소비자에서 기존 편집기 의존성을 제거한 뒤 해당 workspace의 audit·라이선스 결과를 전후 비교한다.

audit은 시점에 따라 달라질 수 있으므로 특정 결과를 설계 문서에 고정하지 않고 Human test 직전에 다시 실행한다.

## 13. 로컬 dist 연결

`.tgz`를 만들지 않는다. library build가 완성된 소비 디렉터리를 만든다.

```text
packages/react/dist
```

Human test에서는 소비자 workspace의 `package.json`이 이 디렉터리를 로컬 `link:` dependency로 참조한다.

```json
{
    "@cp949/simple-html-editor-react": "link:<simple-html-editor-root>/packages/react/dist"
}
```

`<simple-html-editor-root>`는 각 개발자의 checkout 위치로 교체하는 placeholder다. 이 로컬 link는 Human test용이며 배포 가능한 영구 의존성으로 커밋하지 않는다. 실제 배포는 두 공개 패키지에 같은 version을 부여해 함께 수행한다.

CSS는 소비자의 전역 CSS 진입점에서 `@cp949/simple-html-editor-react/styles.css`를 한 번 import한다.

## 14. 소비자 적용 순서

1. simple-html-editor의 전체 검증을 통과한다.
2. `packages/react/dist`를 생성한다.
3. 소비자 저장소의 branch, working tree와 workspace 상태를 확인한다.
4. 대상 workspace에 로컬 dist link를 추가한다.
5. 기존 편집기 wrapper와 직접 사용처를 `<HtmlEditor>`로 전환한다.
6. CKEditor instance를 전달하던 `onEditorReady`를 `HtmlEditorHandle` ref로 교체한다.
7. toolbar DOM 이동과 CKEditor·Quill 전용 스타일을 제거한다.
8. 남은 CKEditor·Quill import와 package dependency를 모두 검색한다.
9. CKEditor와 Quill 의존성을 제거한다.
10. 소비자의 typecheck, format과 대상 빌드를 실행한다.
11. Chrome 85 이상에서 서버 HTML 조회·편집·저장·재조회 Human test를 수행한다.
12. audit와 라이선스 결과를 교체 전후로 비교한다.

소비자의 서버 인터페이스와 저장 로직은 변경하지 않는다. 저장되는 HTML 구조가 정규화될 수 있으므로 기존 콘텐츠와 새 출력의 시각적·의미적 동등성을 Human test에서 확인한다.

## 15. 테스트 전략

### `core`

- 제공된 `intro` HTML의 텍스트·굵기·색상 보존
- 문단과 `<br>` 정규화
- 위험 태그, 이벤트 속성과 위험 URL 제거
- 빈 문서 판정
- 이미지와 표가 있는 문서의 비어 있지 않음 판정
- 기존 CKEditor·Quill HTML fixture의 import/export
- 표 명령의 문서 결과

### `react`

- toolbar 명령과 활성 상태
- 색상 선택·제거
- 파일 선택과 clipboard 이미지 삽입
- `value` 갱신과 `onChange` feedback loop 방지
- 일반 리렌더에서 selection과 undo 유지
- `focus()` handle
- `readOnly`와 placeholder
- unmount cleanup

### 패키지와 브라우저

- fresh `dist`의 export·타입·CSS 검증
- React 18 consumer typecheck와 build
- SSR import 검증
- ES2019 정적 syntax 검사와 Chrome 85 대상 transpilation 설정 검사
- demo에서 로드→편집→저장→재로드 흐름
- audit, 라이선스와 package boundary 검사

### Human test

- 소비자의 대표적인 기존 편집기 화면을 각각 검증한다.
- 기존 서버 콘텐츠를 불러와 시각적으로 비교한다.
- 텍스트 서식, 글자색, 링크, 이미지와 표를 편집한다.
- 저장 후 새로고침하여 서버 HTML을 다시 불러온다.
- 빈 문서 validation과 외부 focus 요청을 확인한다.
- 실제 Chrome 85 환경에서 주요 흐름을 확인한다. 자동화된 최신 Chromium 결과를 Chrome 85 검증으로 대신하지 않는다.
- Chrome 85.0.4182에서 소비자 애플리케이션의 조회 → 편집 → 저장 → 재조회가 성공했다.

## 16. 오류 처리

- 지원하지 않는 HTML은 애플리케이션을 중단시키지 않고 허용 schema로 정규화한다.
- 이미지 읽기 실패는 문서를 변경하지 않고 사용자에게 알릴 수 있는 UI 상태로 표시한다.
- 링크 입력이 허용 URI가 아니면 적용하지 않는다.
- 외부 `value` 적용 중에는 `onChange`를 재호출하지 않는다.
- clipboard에 지원하지 않는 데이터만 있으면 브라우저 기본 붙여넣기를 따른다.
- 빌드, audit, 라이선스 또는 consumer 검증 실패는 배포 차단 조건이다.

## 17. 완료 기준

- 모노리포 package boundary가 검사로 고정되어 있다.
- 공개 인터페이스에 Tiptap·ProseMirror 타입이 노출되지 않는다.
- React 18 consumer와 Chrome 85 target 검증이 통과한다.
- 제공된 외부 HTML과 consumer fixture가 기대한 의미로 왕복된다.
- toolbar, 글자색, 이미지와 기본 표 편집이 동작한다.
- fresh `dist`를 소비자 애플리케이션에서 직접 연결할 수 있다.
- 소비자의 대상 화면에서 서버 저장·재조회 Human test가 가능하다.
- CKEditor와 Quill 제거 후 audit 및 라이선스 목표를 검증할 수 있다.
- 자동 검증 결과와 Human test 결과를 구분해 기록한다.

## 18. 후속 범위

Human test 이후 필요에 따라 다음을 별도 설계한다.

- npm 또는 사설 registry 배포
- toolbar 구성 옵션
- 이미지 업로드 adapter
- 배경색과 글꼴 크기
- 셀 병합·분할과 열 너비 조절
- 플러그인 extension seam
- React 이외의 adapter
- 더 낮거나 더 넓은 브라우저 지원
