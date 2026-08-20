# 공개 저장소 기밀 식별자 보호 설계

- 날짜: 2026-08-20
- 상태: approved
- 대상: 저장소 전체

## 1. 목적

공개 저장소의 파일, Git history와 GitHub 산출물에 사내 프로젝트를 식별할 수 있는 이름, 경로 또는 구현 세부사항을 포함하지 않는다.

## 2. 결정

- 공개 문서와 코드에서는 외부 사용처를 `소비자` 또는 `consumer application`으로 표현한다.
- 실제 사내 프로젝트명, 저장소명, 내부 경로와 내부 컴포넌트명은 기록하지 않는다.
- GitHub Issue, Pull Request, 댓글, 라벨, 링크와 첨부파일에도 같은 규칙을 적용한다.
- 기밀 식별자는 공개 저장소에 문자열 차단 목록으로 기록하지 않고 로컬 전용 검사 입력으로 관리한다.
- 기존 원격 저장소를 삭제하고 같은 이름의 빈 공개 저장소를 다시 만들었으므로, 정제된 현재 파일로 새로운 단일 root commit을 만든다.
- 정제 전 history는 ignored 로컬 bundle로만 보관하며 원격 ref로 전송하지 않는다.

## 3. 포함 범위

- tracked 파일 내용과 파일명의 사내 식별자 제거
- 테스트 fixture의 host, 설명과 테스트 제목 일반화
- 소비자 연동 설계의 내부 경로와 컴포넌트명 제거
- 현재 제품 계약과 기술 결정의 비식별 표현 보존
- 새 root commit 생성 전 build, test, package, audit와 기밀 문자열 검사
- 새 root commit의 parent 부재와 tracked 파일 검사

## 4. 제외 범위

- 원격 push
- GitHub Issue 생성
- npm publish
- ignored 로컬 메모와 runtime snapshot의 공개 문서 이관
- 사내 프로젝트 저장소 변경

## 5. 성공 조건

- 새 원격 저장소에는 branch와 tag가 없는 상태를 유지한다.
- 로컬 `main`은 parent가 없는 단일 root commit이다.
- root commit의 tracked 파일명과 내용에 로컬 차단 식별자가 없다.
- 문서와 테스트는 식별 정보 없이 동일한 제품 계약과 검증 의도를 보존한다.
- `pnpm verify`와 Playwright 검증이 통과한다.
- 정제 전 history는 ignored 로컬 bundle로 복구할 수 있다.
- push는 별도 사용자 승인 전까지 수행하지 않는다.

## 6. 위험과 롤백

위험도: 높음

주요 위험은 필요한 기술 계약까지 제거하거나, 정제 전 commit을 실수로 원격에 push하거나, history 재구성 과정에서 현재 파일을 누락하는 것이다.

롤백: 정제 전 `main` 전체를 ignored Git bundle로 보관하고 `git bundle verify`로 검증한다. 새 root commit 생성 후에도 bundle에서 기존 history를 별도 clone 또는 fetch하여 복구할 수 있다.
