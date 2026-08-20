# 공개 패키지 라이선스 설계

- 날짜: 2026-08-21
- 상태: approved
- 승인 근거: 직접 사용자 지시
- 대상: 저장소 루트, `packages/core`, `packages/react`

## 1. 결정

두 공개 패키지를 MIT 라이선스로 배포한다.

- 저장소 루트에 MIT 전문을 담은 `LICENSE`를 둔다. 저작권자는 `cp949`다.
- 루트와 두 공개 package manifest에 `"license": "MIT"`를 기록한다.
- 두 배포 산출물에 `LICENSE` 전문을 포함한다.

이 설계는 [저장소와 패키지 README 분리 설계](./20260821-03-package-readme-design.md) 4장의 공개 `dist` 파일 수(core 8파일, React 5파일)를 대체한다. 그 밖의 결정은 유지한다.

## 2. 목적

두 패키지는 npm 공개 배포 대상이지만 라이선스 선언이 없었다. `license` 필드와 전문이 모두 없으면 npm은 패키지를 `UNLICENSED`로 표시하고 소비자는 사용 조건을 확인할 수 없다. 소비자의 라이선스 검사 도구도 이 저장소의 패키지를 자동 허용할 수 없다.

MIT는 이 저장소가 의존성에 적용하는 허용 목록의 첫 항목이며 소비자 측 추가 의무를 만들지 않는다.

## 3. 범위

### 포함

- 루트 `LICENSE` 신설
- 루트와 두 공개 package manifest의 `license` 필드
- 두 배포 manifest의 `license` 필드
- 배포 산출물의 `LICENSE` 전문 포함
- dist 파일 목록 계약과 pack allowlist 갱신
- dist manifest의 `license` 값 검사

### 제외

- 기여자 라이선스 동의(CLA) 절차
- `NOTICE` 파일
- private workspace(`apps/demo`, `fixtures/*`)의 라이선스 선언
- 의존성 라이선스 허용 목록 변경

## 4. 배포 산출물

```text
packages/core/dist   8파일 -> 9파일 (LICENSE 추가)
packages/react/dist  5파일 -> 6파일 (LICENSE 추가)
```

`pnpm check:dist`는 두 dist manifest의 `license` 값이 `MIT`인지 검사한다. 파일이나 필드가 없으면 검증이 실패한다.

위험도: 낮음

롤백: 배포 전에는 가능. 이미 배포된 version의 라이선스 선언은 되돌리지 않고 다음 version에서 정정한다.

## 5. 검증

1. `packages/core/dist`와 `packages/react/dist`에 `LICENSE`가 생성된다.
2. 두 dist `package.json`의 `license`가 `MIT`다.
3. `pnpm check:dist`가 core 9파일, React 6파일 목록을 통과한다.
4. `pnpm check:packages`의 `npm pack` 파일 목록이 갱신된 allowlist와 일치한다.
5. `pnpm check:licenses`와 production/full audit이 통과한다.
6. `pnpm verify`를 통과한다.
