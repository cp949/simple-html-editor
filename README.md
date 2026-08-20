# @cp949/editor-simple

React 18.3과 React 19 애플리케이션에서 서버 HTML을 불러오고 편집해 정규화 HTML로 돌려주는 제어형 WYSIWYG 편집기다. 네트워크 요청, 저장, 재시도와 이미지 업로드는 소비자가 소유한다.

## 설치와 import

배포 패키지와 peer dependency를 설치한 뒤 라이브러리 CSS를 애플리케이션의 전역 CSS 진입점에서 한 번 import한다.

```bash
pnpm add @cp949/editor-simple react@^18.3.0 react-dom@^18.3.0
```

```tsx
import { useRef, useState } from 'react'
import { HtmlEditor, type HtmlEditorHandle } from '@cp949/editor-simple'
import '@cp949/editor-simple/styles.css'

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

## 공개 인터페이스

| prop | 타입 | 계약 |
| --- | --- | --- |
| `value` | `string \| undefined` | 표시할 HTML. `undefined`는 빈 문서다. |
| `onChange` | `(html: string \| undefined) => void` | 사용자 편집 뒤 정규화 HTML을 전달한다. 빈 문서는 `undefined`다. |
| `onBlur` | `() => void` | 편집 영역이 포커스를 잃을 때 호출한다. |
| `placeholder` | `string` | 빈 문서에 표시할 안내 문구다. |
| `readOnly` | `boolean` | `true`이면 사용자 편집과 toolbar 명령을 차단한다. 기본값은 `false`다. |
| `className` | `string` | 편집기 최상위 요소에 추가할 클래스 이름이다. |

ref는 `HtmlEditorHandle`의 `focus(): void`만 공개한다. 완전히 다른 문서로 전환하면서 selection과 undo 이력을 분리해야 한다면 소비자가 `key={documentId}`를 지정한다.

## HTML 정규화와 이미지 소유권

외부 `value`는 지원 schema로 읽는다. 사용자 편집 뒤의 `onChange`는 태그 wrapper, 공백, 속성 순서를 바이트 단위로 보존하지 않는 정규화 HTML이다. `<script>`, 이벤트 속성, 위험 URL과 지원하지 않는 style은 저장 계약에서 제외된다.

파일 선택과 clipboard의 PNG, JPEG, GIF, WebP 이미지는 bitmap data URL로 HTML 안에 들어간다. 이 data URL을 그대로 저장할지, 파일로 변환해 URL을 교체할지, 용량 제한과 업로드 실패를 어떻게 처리할지는 소비자 책임이다. SVG data URL은 허용하지 않는다.

## 브라우저 지원

최소 지원 버전과 JavaScript/demo build target은 Chrome 85다. 호환성 검사는 build와 정적 검증에 포함되지만 최신 Playwright Chromium 자동화는 실제 Chrome 85 실행 증거가 아니다. Chrome 85 지원 승인은 대상 애플리케이션에서 별도 Human test가 필요하다. Chrome 82 지원은 향후 별도로 검토한다.

## 로컬 `dist` 연결

라이브러리를 먼저 빌드하면 공개 산출물은 다음 절대 경로에 생성된다.

```text
packages/react/dist
```

로컬 소비자 `package.json`에서 완성된 `dist`를 직접 연결할 수 있다.

```json
{
  "dependencies": {
    "@cp949/editor-simple": "link:<simple-html-editor-root>/packages/react/dist"
  }
}
```

`<simple-html-editor-root>`는 각 개발자의 checkout 위치로 교체하는 placeholder다. 이 로컬 link는 Human test 전용이며 배포 가능한 영구 의존성으로 커밋하지 않는다. 연결 뒤에도 소비자의 전역 CSS 진입점에서 `@cp949/editor-simple/styles.css`를 import해야 한다.

## 개발과 검증

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm format
pnpm format:check
pnpm lint
pnpm lint:fix
pnpm build
pnpm test
pnpm exec playwright test
pnpm verify
```

`pnpm verify`는 build, typecheck, 단위 테스트, package boundary, fresh public `dist`, 라이선스와 production/full audit을 검사한다. 공개 `dist`는 `index.js`, `index.d.ts`, `styles.css`, `package.json` 네 파일만 가진다.

## 라이선스 정책

허용 목록은 MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, MPL-2.0다. 목록에 없거나 복합식인 라이선스는 자동 허용하지 않는다. `pnpm check:licenses`가 전체 설치 graph, lockfile과 실제 bundle module evidence로 `docs/product/dependency-licenses.md`를 생성하며, `pnpm audit:prod`와 `pnpm audit:full`은 각각 production graph와 전체 graph에서 info, low, moderate, high, critical이 모두 0인지 검사한다. 어떤 severity라도 0이 아니면 verify를 통과할 수 없다.
