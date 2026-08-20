# HTML 저장 계약

- 관리 방식: 수동 편집
- 기반 설계: `docs/specs/20260820-02-html-editor-design.md`
- 이미지 표현: `docs/specs/20260820-05-image-presentation-design.md`

## 1. 책임

이 문서는 소비자가 편집기에 전달하는 저장 HTML과 편집기가 돌려주는 정규화 HTML 사이의 계약을 기록하는 단일 원본이다. 세 README는 이 문서를 링크하고 요약만 제공한다.

## 2. 값 계약

- 입력 `value`가 `undefined`이면 빈 문서다.
- 편집 결과가 빈 문서면 `onChange(undefined)`를 호출한다.
- 빈 문서 판정은 HTML 문자열 길이가 아니라 문서 구조로 한다. 공백이 아닌 텍스트, image node 또는 table node 중 하나라도 있으면 내용이 있다고 본다.
- 공백만 있는 문단이나 빈 문단의 존재는 내용으로 보지 않는다.

## 3. 보존하지 않는 것

정규화 HTML은 입력 HTML과 바이트 단위로 같지 않다. 다음은 보존 계약이 아니다.

- 태그 wrapper 구조와 중첩 형태
- 속성 순서와 style 선언 순서
- 태그 사이 공백, 줄바꿈과 들여쓰기
- 지원하지 않는 태그, class, `data-*` 속성과 inline style
- 표의 `colgroup`, 셀 병합·분할, 열 너비와 셀별 스타일
- 배경색

## 4. 지원 문서 구조

| 의미 | 정규화 출력 |
| --- | --- |
| 문단 | `<p>` |
| 제목 | `<h1>`~`<h6>` (toolbar는 1~4 제공) |
| 인용 | `<blockquote>` |
| 글머리 목록 | `<ul>` + `<li>` |
| 번호 목록 | `<ol>` + `<li>` |
| 코드 블록 | `<pre><code>` |
| 수평선 | `<hr>` |
| 줄바꿈 | `<br>` |
| 굵게 | `<strong>` |
| 기울임 | `<em>` |
| 밑줄 | `<u>` |
| 취소선 | `<s>` |
| 인라인 코드 | `<code>` |
| 링크 | `<a href>` |
| 글자색 | `<span style="color: ...">` |
| 문단 정렬 | `<p>`, `<h1>`~`<h6>`의 `text-align` |
| 이미지 | `<img>` |
| 표 | `<table>`, `<tr>`, `<th>`, `<td>` |

입력에서 `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`를 읽고 행·셀과 header cell 의미를 유지한다. 출력 wrapper는 Tiptap 정규형을 따른다.

## 5. 제거 대상

- `<script>`, `<style>`, `<iframe>`과 실행 가능한 embed
- `onclick` 등 모든 이벤트 속성
- 허용 목록 밖의 URL protocol
- 지원하지 않는 태그. 의미 있는 텍스트만 남기거나 제거한다.
- 지원하지 않는 class, `data-*` 속성과 inline style

별도 sanitizer 의존성을 사용하지 않고 Tiptap schema를 allowlist로 사용한다. schema만으로 판정할 수 없는 링크 protocol, 이미지 source와 inline style은 core의 parse rule에서 명시적으로 검증한다.

## 6. 링크 URL 정책

`isAllowedLinkHref(value)`가 판정한다.

- 허용 protocol: `http:`, `https:`, `mailto:`, `tel:`
- protocol이 없는 상대 경로는 허용한다.
- 빈 문자열과 공백만 있는 값은 거부한다.
- `//`, `\\`로 시작하는 protocol-relative URL은 거부한다.
- protocol 판정 전에 `U+0000`~`U+0020` 제어문자를 제거한다. 브라우저가 scheme 해석에서 무시하는 문자로 우회할 수 없다.
- 거부된 `href`는 링크를 제거하고 텍스트만 남긴다.
- autolink와 클릭 시 이동은 비활성이다.

## 7. 이미지 정책

`isAllowedImageSrc(value)`가 판정한다.

- 허용 protocol: `http:`, `https:`, `blob:`
- protocol이 없는 상대 경로는 허용한다.
- 허용 data URL: `data:image/png`, `data:image/jpeg`, `data:image/gif`, `data:image/webp`의 base64 형식만 허용한다.
- SVG data URL과 그 밖의 실행 가능성이 있는 형식은 거부한다.
- 거부된 `src`는 image node 전체를 거부한다.

image node는 `src`, `alt`, `width`, `alignment` 의미만 가진다.

```ts
type ImageAlignment = 'left' | 'center' | 'right';

type ImagePresentation = {
  src: string;
  alt: string | null;
  width: number | null;
  alignment: ImageAlignment;
};
```

- `width`는 `1`~`10000` 범위의 ASCII 양의 정수만 읽고 출력한다. 범위 밖이면 제거한다.
- `height`는 저장하지 않는다.
- 정렬은 `margin-left`/`margin-right`의 `0`/`auto` 조합으로만 표현한다. 왼쪽은 `0`/`auto`, 가운데는 `auto`/`auto`, 오른쪽은 `auto`/`0`이다. 그 밖의 조합은 왼쪽으로 정규화한다.
- `display`, `max-width`, `height`는 각각 `block`, `100%`, `auto`로 정규화한다.
- wrapper 요소를 만들지 않고 `<img>` 하나로 출력한다.

```html
<img src="https://cdn.example.com/image.png" alt="대표 이미지" width="320" style="display: block; max-width: 100%; height: auto; margin-left: auto; margin-right: auto">
```

## 8. 이미지 소유권

파일 선택과 clipboard 붙여넣기로 삽입한 이미지는 bitmap data URL로 HTML 안에 들어간다. 다음은 모두 소비자 책임이다.

- data URL을 그대로 저장할지, 파일로 변환하고 `src`를 URL로 교체할지 결정
- 업로드 대상, 인증과 실패 처리
- 파일 크기와 문서 전체 용량 제한
- 저장 후 남은 참조 정리

편집기는 네트워크 인터페이스를 갖지 않는다.

## 9. 글자색

- 선택 영역에 색을 적용하고 제거하는 두 명령을 제공한다.
- 출력은 `<span style="color: ...">`로 정규화한다.
- 입력에서는 `<span>`, `<strong>`, `<em>`, `<u>`의 `style` 안에 선언된 `color`를 읽는다.
- 배경색은 읽기, 편집과 보존을 보장하지 않는다.
