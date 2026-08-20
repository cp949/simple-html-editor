# @cp949/simple-html-editor-react

서버 HTML을 불러와 사람이 편집하고 저장할 HTML로 돌려주는 React 제어형 WYSIWYG 편집기다.

네트워크 요청, 저장, 재시도와 이미지 업로드는 이 패키지가 담당하지 않는다. 편집기는 네트워크 인터페이스를 갖지 않는다.

## 요구사항

| 항목 | 범위 |
| --- | --- |
| `react`, `react-dom` | `>=18.3.0 <20` (peer dependency) |
| 브라우저 | Chrome 81 이상 |
| 모듈 형식 | ESM. SSR import 안전 |

## 설치

```bash
pnpm add @cp949/simple-html-editor-react react react-dom
```

```bash
npm install @cp949/simple-html-editor-react react react-dom
```

CSS를 애플리케이션의 전역 CSS 진입점에서 한 번 import한다. import하지 않으면 toolbar와 편집 영역의 테두리, 간격과 상태 표시가 적용되지 않는다.

```ts
import '@cp949/simple-html-editor-react/styles.css'
```

## 사용

```tsx
import { useRef, useState } from 'react'
import { HtmlEditor, type HtmlEditorHandle } from '@cp949/simple-html-editor-react'

export function PostEditor() {
  const [html, setHtml] = useState<string | undefined>('<p>서버 HTML</p>')
  const editorRef = useRef<HtmlEditorHandle>(null)

  return (
    <>
      <button type="button" onClick={() => editorRef.current?.focus()}>
        편집기로 이동
      </button>
      <HtmlEditor
        ref={editorRef}
        value={html}
        onChange={setHtml}
        placeholder="HTML 내용을 입력하세요"
      />
    </>
  )
}
```

## API

### `HtmlEditorProps`

| prop | 타입 | 필수 | 계약 |
| --- | --- | --- | --- |
| `value` | `string \| undefined` | 아니오 | 표시할 HTML. `undefined`는 빈 문서다. |
| `onChange` | `(html: string \| undefined) => void` | 예 | 사용자 편집 뒤 정규화 HTML을 전달한다. 빈 문서는 `undefined`다. |
| `onBlur` | `() => void` | 아니오 | 편집 영역이 포커스를 잃을 때 호출한다. |
| `placeholder` | `string` | 아니오 | 빈 문서에 표시할 안내 문구다. |
| `readOnly` | `boolean` | 아니오 | `true`이면 사용자 편집, toolbar 명령과 이미지 상호작용을 차단한다. 기본값은 `false`다. |
| `className` | `string` | 아니오 | 편집기 최상위 요소에 추가할 클래스 이름이다. |

### `HtmlEditorHandle`

`focus(): void` 하나만 공개한다. Tiptap과 ProseMirror 인스턴스는 노출하지 않는다.

### 값 동기화

- 최초 `value`를 편집기 초기값으로 사용한다.
- 부모가 새 HTML을 전달하면 편집기 내용을 갱신한다.
- `onChange` 결과가 부모를 통해 되돌아오는 일반 리렌더에서는 selection과 undo 이력을 초기화하지 않는다.
- 완전히 다른 문서로 전환하면서 selection과 undo 이력을 분리하려면 `key={documentId}`를 지정한다.

## 편집 기능

문단과 제목 1~4, 굵게, 기울임, 밑줄, 취소선, 글자색 지정과 제거, 인용, 글머리 목록, 번호 목록, 들여쓰기와 내어쓰기, 문단 정렬, 링크 생성과 제거, 이미지 삽입·크기 조절·가로 정렬, 표 삽입과 행·열 추가·삭제, 표 삭제, 서식 지우기를 제공한다.

toolbar는 편집기가 소유하며 외부 DOM으로 이동하지 않는다. 모든 버튼은 접근 가능한 이름, pressed 상태와 disabled 상태를 제공한다.

## HTML 저장 계약

`onChange`가 전달하는 HTML은 입력 HTML과 바이트 단위로 같지 않다. 태그 wrapper, 공백과 속성 순서는 보존 계약이 아니다.

- `<script>`, `<style>`, iframe, 이벤트 속성과 지원하지 않는 inline style은 제거한다.
- 링크는 `http:`, `https:`, `mailto:`, `tel:`과 상대 경로만 유지한다.
- 이미지는 `http:`, `https:`, `blob:`, 상대 경로와 PNG·JPEG·GIF·WebP base64 data URL만 유지한다. SVG data URL은 거부한다.
- 빈 문서 판정은 문자열 길이가 아니라 문서 구조로 한다. 공백만 있는 문단은 내용으로 보지 않는다.

전체 계약은 [HTML 저장 계약](https://github.com/cp949/simple-html-editor/blob/main/docs/product/html-contract.md)에 있다.

## 이미지 소유권

파일 선택과 clipboard 붙여넣기로 넣은 PNG, JPEG, GIF, WebP 이미지는 bitmap data URL로 HTML 안에 들어간다. 다음은 소비자 책임이다.

- data URL을 그대로 저장할지, 파일로 변환하고 `src`를 URL로 교체할지 결정
- 업로드 대상, 인증과 실패 처리
- 파일 크기와 문서 전체 용량 제한

## 스타일 조정

최상위 요소는 `.editor-simple` 클래스를 사용하고 다음 CSS custom property를 읽는다.

| property | 기본값 |
| --- | --- |
| `--editor-simple-border-color` | `#d1d5db` |
| `--editor-simple-background` | `#ffffff` |
| `--editor-simple-foreground` | `#1f2937` |
| `--editor-simple-min-height` | `16rem` |
| `--editor-simple-max-height` | `32rem` |

```css
.post-editor {
  --editor-simple-min-height: 24rem;
  --editor-simple-border-color: #94a3b8;
}
```

## core 직접 사용

React UI 없이 HTML 정책과 extension 집합만 필요하면 [`@cp949/simple-html-editor-core`](https://www.npmjs.com/package/@cp949/simple-html-editor-core)를 사용한다. 두 패키지는 항상 같은 버전으로 배포하며, 이 패키지는 같은 버전의 core를 runtime dependency로 포함한다.

## 링크

- 저장소: <https://github.com/cp949/simple-html-editor>
- 이슈: <https://github.com/cp949/simple-html-editor/issues>

## 라이선스

MIT. 전문은 패키지의 `LICENSE`에 포함되어 있다.
