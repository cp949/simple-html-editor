# HTML 편집기 제품 기능 계약

- 날짜: 2026-08-20
- 상태: approved
- 대상: 공개 React HTML 편집기

## 1. 목적

이 문서는 편집기가 사용자와 소비자에게 제공해야 하는 제품 기능을 정의한다. 구현 구조와 의존성 결정은 `docs/specs/20260820-02-html-editor-design.md`, toolchain과 검증 기준은 `docs/specs/20260820-03-dependency-upgrade-design.md`가 담당한다.

기능의 진행 상태는 GitHub Issue에서 관리한다. Issue는 이 계약을 복제하지 않고 관련 절과 acceptance criteria만 링크한다.

## 2. 기능 상태

| 상태 | 의미 |
| --- | --- |
| 필수 | 현재 제공하며 회귀를 허용하지 않는 제품 계약 |
| 예정 | 구현하기로 승인했지만 아직 필수 기능으로 제공하지 않는 계약 |
| 보류 | 후보이지만 구현과 제공을 약속하지 않는 기능 |
| 비범위 | 편집기가 책임지지 않는 기능 |

예정 기능은 구현·검증 완료와 사용자 승인 후 필수로 이동한다. Issue의 생성이나 종료만으로 이 문서의 상태가 자동 변경되지 않는다.

## 3. 필수 기능

### 3.1 저장 HTML 입출력

- 소비자가 제공한 저장 HTML을 편집 가능한 문서로 표시한다.
- 사용자 편집 결과는 `onChange`를 통해 정규화 HTML로 전달한다.
- 빈 문서는 `undefined`로 전달한다.
- 공백이나 빈 문단만 있는 문서는 빈 문서다.
- 이미지나 표가 있으면 텍스트가 없어도 빈 문서가 아니다.
- 외부 `value` 변경을 현재 문서에 반영한다.
- `onChange` 결과가 부모를 통해 되돌아오는 일반 리렌더에서는 selection과 undo 이력을 초기화하지 않는다.
- 완전히 다른 문서의 lifecycle 구분은 소비자가 React `key`로 제어할 수 있다.

### 3.2 공개 React 인터페이스

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
```

- `focus()`는 편집 영역으로 포커스를 이동한다.
- `onBlur`는 편집 영역이 포커스를 잃을 때 호출한다.
- `placeholder`는 빈 문서에 안내 문구를 표시한다.
- `readOnly`는 입력, toolbar 명령, 이미지 선택과 이미지 붙여넣기를 차단한다.
- `className`은 편집기 최상위 요소에 적용한다.
- 공개 타입에는 Tiptap과 ProseMirror 타입을 노출하지 않는다.

### 3.3 기본 블록과 인라인 서식

- 문단
- 제목 1~4
- 굵게
- 기울임
- 밑줄
- 취소선
- 인용구
- 선택 영역의 서식 지우기

toolbar는 현재 selection의 활성 서식을 표시하고 실행할 수 없는 명령을 비활성화한다.

### 3.4 목록

- 글머리 목록
- 번호 목록
- 목록 항목 들여쓰기
- 목록 항목 내어쓰기

목록 명령은 현재 selection이 허용하는 경우에만 실행한다.

### 3.5 문단 정렬

- 왼쪽 정렬
- 가운데 정렬
- 오른쪽 정렬

정렬 상태는 정규화 HTML에 보존되고 다시 불러왔을 때 같은 의미로 표시되어야 한다.

### 3.6 링크

- 선택 영역에 링크 설정
- 기존 링크 주소 변경
- 링크 제거
- 현재 링크 주소를 수정 UI의 초기값으로 사용
- 상대 경로와 hash 링크 허용
- `http:`, `https:`, `mailto:`, `tel:` 허용
- 실행 가능한 protocol과 protocol-relative URL 거부

허용하지 않는 URL을 입력하면 문서를 변경하지 않는다.

### 3.7 글자색

- 선택 영역에 글자색 설정
- 글자색 제거
- 외부 HTML의 안전한 `color` 값을 읽기
- 색상을 정규화된 `<span style="color: ...">` 의미로 저장

글자색 이외의 임의 inline style은 보존하지 않는다.

### 3.8 이미지

- 파일 선택으로 이미지 삽입
- clipboard 이미지 붙여넣기
- PNG, JPEG, GIF, WebP 파일 지원
- `http:`, `https:`, `blob:` 이미지 URL과 허용된 bitmap data URL 지원
- SVG data URL과 실행 가능한 source 거부
- 파일 삽입 이미지는 data URL로 정규화 HTML에 포함
- 파일 읽기 실패를 문서 변경 없이 사용자에게 알림
- 선택 취소, readOnly 전환과 unmount 이후의 비동기 결과 무시

서버 업로드와 data URL의 파일 변환은 소비자가 담당한다.

### 3.9 표

- header 행이 있는 3×3 표 삽입
- 표 셀 내용 편집
- 현재 행의 위·아래에 행 추가
- 현재 열의 왼쪽·오른쪽에 열 추가
- 현재 행 삭제
- 현재 열 삭제
- 전체 표 삭제
- 마지막 한 행이나 한 열만 남은 경우 해당 삭제 명령 비활성화
- 표 밖에서는 표 삽입을, 표 안에서는 문맥별 표 명령을 표시

외부 표의 header-cell과 일반 cell 의미는 유지하지만 wrapper, 너비와 셀별 style의 바이트 단위 보존은 계약하지 않는다.

### 3.10 HTML 정규화와 안전성

- `<script>`, `<style>`, iframe과 실행 가능한 embed 제거
- 이벤트 속성 제거
- 위험한 링크와 이미지 source 제거
- 지원하지 않는 class, data attribute와 inline style 제거
- 지원하지 않는 태그는 의미 있는 텍스트를 유지할 수 있으면 텍스트만 유지
- 지원하는 문단, 제목, 목록, 인용, 링크, 이미지, 표와 text mark를 일관된 HTML로 출력

입력 HTML의 공백, 속성 순서, tag 선택과 wrapper 구조를 그대로 보존하지 않는다. 안전성과 지원 schema가 원본 문자열 보존보다 우선한다.

### 3.11 Toolbar와 접근성

- 편집기 위에 기본 toolbar 표시
- toolbar의 접근 가능한 이름 제공
- 버튼별 label과 pressed 상태 제공
- toolbar 조작 중 selection 유지
- readOnly 상태에서 모든 변경 control 비활성화
- 소비자가 별도 UI framework를 설치하지 않아도 동작
- root class와 CSS custom property로 높이, 색상과 테두리 조정 가능

### 3.12 호환성과 배포 산출물

- React 18.3과 React 19 지원
- Chrome 85 이상 지원
- SSR 환경에서 안전한 import
- ESM JavaScript, TypeScript 선언과 CSS export 제공
- 공개 dist는 `index.js`, `index.d.ts`, `styles.css`, `package.json` 네 파일로 구성
- React와 ReactDOM만 peer dependency로 노출
- production/full audit의 모든 severity가 0이어야 함
- 직접·전이·번들 의존성이 승인된 라이선스 allowlist를 통과해야 함

자동화된 최신 Chromium 테스트는 실제 Chrome 85 Human test를 대신하지 않는다.

## 4. 예정 기능

### 4.1 Lucide toolbar 아이콘

- toolbar의 작업 버튼에 Lucide 아이콘을 적용한다.
- 아이콘만 표시하는 버튼도 접근 가능한 label을 유지한다.
- 아이콘 의미를 확인할 수 있는 tooltip을 제공한다.
- 제목 단계, 색상 입력처럼 텍스트나 native control이 더 명확한 항목은 무리하게 아이콘만 사용하지 않는다.
- 아이콘 전환은 기존 명령, 활성 상태, disabled 상태와 selection 유지 동작을 바꾸지 않는다.

### 4.2 이미지 drag resize

- 선택한 이미지에 resize handle을 표시한다.
- pointer drag로 이미지 표시 너비를 조절한다.
- 기본 동작은 원본 가로세로 비율을 유지한다.
- 이미지는 편집 영역의 가로폭을 넘지 않는다.
- readOnly에서는 handle을 표시하거나 크기를 변경하지 않는다.
- 저장 후 다시 불러와도 조정한 크기를 유지한다.
- 크기 표현은 안전한 allowlist로 정규화하며 임의 style 보존을 허용하지 않는다.

구체적인 HTML attribute와 style 표현은 기능별 설계에서 정하되 소비자가 별도 상태를 저장하도록 요구하지 않는다.

### 4.3 이미지 가로 정렬

- 이미지 왼쪽 정렬
- 이미지 가운데 정렬
- 이미지 오른쪽 정렬
- 현재 정렬 상태를 toolbar에 표시
- readOnly에서는 정렬 변경 차단
- 저장 후 다시 불러와도 정렬 유지
- 정렬 변경 시 이미지 source와 대체 텍스트를 보존

구체적인 HTML 표현은 기능별 설계에서 정하되 정규화 HTML만으로 상태를 복원할 수 있어야 한다.

## 5. 보류 기능

- 실행 취소·다시 실행 toolbar 버튼
- 수평선과 코드 블록
- 체크리스트
- 양쪽 정렬
- 새 창에서 링크 열기
- 브라우저 prompt를 대체하는 링크 편집 UI
- 배경색과 사전 정의 색상 팔레트
- 이미지 대체 텍스트 편집 UI
- 이미지 삭제 전용 UI
- 초기 표 크기 선택
- 표 셀 병합·분할
- 표 열 너비 조절
- 표 header 행·열 전환
- 표 셀 정렬과 배경색
- 전체·간단 toolbar mode
- toolbar 기능별 활성화 설정
- 최소·최대 높이 props
- 글자 수와 최대 길이
- 좁은 화면의 toolbar overflow UI
- toolbar 키보드 탐색 확장
- Chrome 82 지원

보류 기능은 Issue를 만들거나 구현을 시작하기 전에 이 문서에서 예정 기능으로 승격해야 한다.

## 6. 비범위

- Markdown 입출력과 미리보기
- HTML source 편집
- 저장·조회 API
- 이미지 업로드 API
- 네트워크 재시도와 알림
- 내부 편집 엔진 instance 공개
- 입력 HTML의 바이트 단위 무손실 보존
- 임의 글꼴과 글꼴 크기
- 실시간 공동 편집
- 댓글과 변경 추적
- 문서 파일 import/export
- 특정 기존 편집기 instance API 호환

## 7. Demo와 개발 지원

다음 항목은 제품 기능이 아니라 개발·검증 요구사항이다.

- `[예정]` 저장소 루트에서 `pnpm demo`로 demo 실행
- `[필수]` demo에서 저장 HTML 불러오기, 편집, 저장과 재조회 흐름 검증
- `[예정]` 예정 기능을 구현할 때 demo에 대표 Human test 시나리오 추가
- `[필수]` Biome format/lint, typecheck, unit/integration test, dist, audit와 라이선스 gate 유지

배포 방식, Changesets 사용 여부와 배포 절차는 별도 release 설계에서 결정한다.

## 8. 계약 변경 절차

- GitHub Issue는 작업 상태, 담당자, 논의와 실행 체크리스트의 기준이다.
- 이 문서는 제품 기능의 상태와 사용자에게 약속한 결과의 기준이다.
- Issue 본문에 이 문서를 복제하지 않고 관련 절과 acceptance criteria를 링크한다.
- Issue 논의가 필수·예정·보류·비범위 상태를 바꾸면 구현 전에 이 문서를 수정하고 승인받는다.
- 구현 완료만으로 예정 기능을 필수로 자동 변경하지 않는다. 자동 검증과 필요한 Human test 후 사용자 승인을 받아 변경한다.
- 세부 구현 결정이 여러 기능에 장기 영향을 주면 별도 ADR로 기록한다.

## 9. 성공 조건

- 현재 구현과 필수 기능이 모순되지 않는다.
- 예정 기능과 현재 제공 기능이 명확히 구분된다.
- 보류 기능은 구현 약속으로 오해되지 않는다.
- 소비자 책임과 편집기 책임이 분리된다.
- 각 예정 기능은 독립된 spec 또는 Issue acceptance criteria로 분해할 수 있다.
- 공개 문서와 GitHub 산출물에 사내 식별 정보를 기록하지 않는다.
