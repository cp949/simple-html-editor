# @cp949/simple-html-editor-core

서버 HTML을 편집기 문서로 읽고 정규화 HTML로 되돌리는 규칙을 제공하는 headless 패키지다. React에 의존하지 않는다.

React 애플리케이션이라면 이 패키지를 직접 설치하지 않고 [`@cp949/simple-html-editor-react`](https://www.npmjs.com/package/@cp949/simple-html-editor-react)를 사용한다. React 패키지가 이 패키지를 같은 버전의 runtime dependency로 포함한다. 이 패키지는 다른 프레임워크 adapter를 만들거나 UI 없이 HTML 정책만 적용할 때 사용한다.

## 설치

```bash
pnpm add @cp949/simple-html-editor-core
```

Tiptap 3.x runtime을 dependency로 포함한다. `Editor`나 `EditorState` 같은 Tiptap 타입을 직접 import하려면 소비자도 해당 패키지를 선언한다.

```bash
pnpm add @tiptap/core @tiptap/pm
```

## 공개 API

| symbol | 시그니처 | 역할 |
| --- | --- | --- |
| `createHtmlEditorExtensions` | `(imageNodeViewRenderer?: NodeViewRenderer) => AnyExtension[]` | HTML schema와 정규화 정책이 적용된 extension 집합을 만든다. |
| `isEditorDocumentEmpty` | `(document: JSONContent) => boolean` | 저장할 텍스트, 이미지 또는 표가 없는 문서인지 판정한다. |
| `isAllowedLinkHref` | `(value: string) => boolean` | 링크로 저장할 수 있는 URL인지 판정한다. |
| `isAllowedImageSrc` | `(value: string) => boolean` | 이미지로 저장할 수 있는 URL 또는 bitmap data URL인지 판정한다. |
| `selectedImageAlignment` | `(state: EditorState) => 'left' \| 'center' \| 'right' \| null` | 정확히 하나의 image node를 선택한 상태면 현재 가로 정렬을, 아니면 `null`을 돌려준다. |

이 패키지의 타입 선언은 `@tiptap/core`와 `@tiptap/pm` 타입을 노출한다. React 패키지의 공개 선언은 노출하지 않는다.

## 사용

```ts
import { Editor } from '@tiptap/core'
import { createHtmlEditorExtensions, isEditorDocumentEmpty } from '@cp949/simple-html-editor-core'

const editor = new Editor({
  element: document.querySelector('#editor') as HTMLElement,
  extensions: createHtmlEditorExtensions(),
  content: '<p>서버에서 받은 저장 HTML</p>',
})

// 저장할 값. 빈 문서는 undefined로 다룬다.
const html = isEditorDocumentEmpty(editor.getJSON()) ? undefined : editor.getHTML()
```

`createHtmlEditorExtensions`가 구성하는 extension은 StarterKit(link, underline 제외), Underline, 링크 정책이 적용된 Link, 이미지 정책이 적용된 Image, TextAlign, TextStyle, Color, TableKit이다. `imageNodeViewRenderer`를 전달하면 같은 image schema에 NodeView renderer만 연결한다. 저장 표현은 바뀌지 않는다.

`extensions` 배열을 소비자가 직접 수정하면 아래 저장 계약이 깨질 수 있다.

## HTML 저장 계약

`editor.getHTML()` 결과는 입력 HTML과 바이트 단위로 같지 않다. 태그 wrapper, 공백과 속성 순서는 보존 계약이 아니다.

- 허용 링크 protocol: `http:`, `https:`, `mailto:`, `tel:`과 상대 경로
- 허용 이미지 protocol: `http:`, `https:`, `blob:`과 상대 경로
- 허용 이미지 data URL: PNG, JPEG, GIF, WebP의 base64. SVG data URL은 거부한다.
- `<script>`, `<style>`, iframe, 이벤트 속성과 지원하지 않는 inline style은 제거한다.

전체 계약은 [HTML 저장 계약](https://github.com/cp949/simple-html-editor/blob/main/docs/product/html-contract.md)에 있다.

## 버전과 브라우저

- `@cp949/simple-html-editor-react`와 항상 같은 버전으로 배포한다. 두 패키지를 함께 사용할 때는 버전을 일치시킨다.
- 빌드 target은 Chrome 81이다.

## 링크

- 저장소: <https://github.com/cp949/simple-html-editor>
- 이슈: <https://github.com/cp949/simple-html-editor/issues>

## 라이선스

MIT. 전문은 패키지의 `LICENSE`에 포함되어 있다.
