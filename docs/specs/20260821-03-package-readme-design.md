# 저장소와 패키지 README 분리 설계

- 날짜: 2026-08-21
- 상태: approved
- 승인 근거: 직접 사용자 지시
- 대상: 저장소 루트, `packages/core`, `packages/react`

## 1. 결정

README를 독자에 따라 세 문서로 분리한다.

| 파일 | 독자 | 책임 |
| --- | --- | --- |
| `README.md` | GitHub 방문자, 기여자 | 저장소 소개, 패키지 목록, 개발과 검증 절차, 릴리스 정책 |
| `packages/react/README.md` | npm 소비자(기본 진입점) | `<HtmlEditor>` 설치, 공개 API 계약, 값과 이미지 소유권 |
| `packages/core/README.md` | npm 소비자(headless) | React 비의존 정책 API와 extension 구성 |

HTML 저장 계약의 상세는 세 README에 복제하지 않고 `docs/product/html-contract.md`를 단일 원본으로 둔다. 각 README는 요약과 링크만 포함한다.

이 설계는 `docs/specs/20260820-02-html-editor-design.md` 11장의 공개 `dist` 파일 수(core 7파일, React 4파일)를 대체한다. 파일 구성 원칙, 패키지 이름, 버전 계약과 export 계약은 유지한다.

## 2. 목적

현재 루트 `README.md` 하나가 npm 패키지 API 계약과 저장소 개발 절차를 함께 담고 있고 제목이 `@cp949/simple-html-editor-react`다. 저장소 방문자는 개발 절차를, npm 방문자는 API 계약을 각각 원하지만 두 독자 모두 자신과 무관한 절반을 읽어야 한다. npm 패키지 페이지에는 README가 아예 표시되지 않는다.

## 3. 범위

### 포함

- 루트 README 재작성
- 두 공개 패키지 README 신규 작성
- `docs/product/html-contract.md` 신설
- 두 패키지 README를 배포 산출물에 포함
- dist 파일 목록 계약과 pack allowlist 갱신
- roadmap 공통 제약과 관련 spec 참조 갱신

### 제외

- 공개 API, HTML 정책 또는 브라우저 지원 범위 변경
- `LICENSE` 파일과 `license` manifest 필드 신설. [공개 패키지 라이선스 설계](./20260821-04-package-license-design.md)에서 다룬다.
- npm publish 실행
- 영문 번역본

## 4. 배포 산출물

npm 배포 단위는 `packages/core/dist`와 `packages/react/dist`이고 두 디렉터리의 파일 목록은 정확 일치로 고정되어 있다. 패키지 README를 npm 페이지에 노출하려면 build가 `packages/<kind>/README.md`를 dist로 복사해야 한다.

```text
packages/core/dist   7파일 -> 8파일 (README.md 추가)
packages/react/dist  4파일 -> 5파일 (README.md 추가)
```

이 파일 수는 [공개 패키지 라이선스 설계](./20260821-04-package-license-design.md)가 core 9파일, React 6파일로 대체한다.

복사 실패는 build 실패로 처리한다. dist에 README가 없으면 `pnpm check:dist`와 `pnpm check:packages`가 실패한다.

위험도: 낮음

롤백: 가능. 파일 목록 계약과 복사 단계를 되돌리면 이전 산출물과 같다.

## 5. 문서 중복 정책

- HTML 저장 계약, URL 정책, 이미지 표현과 표 계약의 원본은 `docs/product/html-contract.md`다.
- 패키지 README는 소비자가 즉시 판단해야 하는 항목만 5줄 이내로 요약하고 원본을 링크한다.
- 루트 README는 API 계약을 서술하지 않고 패키지 README를 링크한다.
- 개발 명령, 검증 게이트와 릴리스 절차는 루트 README에만 둔다.
- 세 문서 모두 개발자 컴퓨터의 절대 경로를 기록하지 않고 `<repository-root>`, `<consumer-app-root>` 형태의 placeholder를 사용한다.

## 6. 검증

1. `packages/core/dist`와 `packages/react/dist`에 `README.md`가 생성된다.
2. `pnpm check:dist`가 core 8파일, React 5파일 목록을 통과한다.
3. `pnpm check:packages`의 `npm pack` 파일 목록이 갱신된 allowlist와 일치한다.
4. 루트 README, roadmap과 관련 spec에 이전 파일 수(7/4)가 남아 있지 않다.
5. 세 README와 `docs/product/html-contract.md`에 사내 식별자와 절대 경로가 없다.
6. `pnpm verify`를 통과한다.
