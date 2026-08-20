# 로컬 dev 작업 흐름 설계

- 날짜: 2026-08-21
- 상태: approved
- 대상: 저장소 공통 개발·이슈·커밋 운영

## 1. 목적

작업은 하나의 로컬 `dev` 브랜치에서 진행하고, 구현 중 발견한 현재 범위 밖의 후속 작업은 GitHub Issue로 즉시 보존한다. 구현 과정의 checkpoint commit은 원격에 공개하기 전에 논리 단위로 재구성하고, 로컬 검증 결과를 근거로 현재 이슈를 종료한다.

이 흐름은 worktree, 기능별 브랜치와 Pull Request 없이도 다음 성질을 유지해야 한다.

- 현재 작업과 후속 작업의 범위 분리
- 사용자 변경과 다른 이슈의 commit 보존
- 검토·복구 가능한 최종 commit 이력
- push 권한과 이슈 운영 권한의 명확한 분리
- 공개 저장소 기밀 정보 정책 준수

## 2. 브랜치 모델

### 2.1 초기화

현재 `origin/main`에서 upstream 없는 로컬 `dev`를 한 번 생성한다. agent는 worktree를 만들지 않고 이 checkout의 `dev`에서 작업한다.

원격 `origin/dev` 생성은 원칙적으로 사용자가 다음 명령으로 수행한다. 사용자가 별도로 명시하면 agent가 이 최초 push를 수행할 수 있다.

```bash
git push -u origin dev
```

로컬 `dev`는 `origin/main`을 upstream으로 설정하지 않는다. 최초 push 이후에는 `origin/dev`를 추적하고 같은 commit을 가리켜야 한다.

### 2.2 지속 운영

- 기능 브랜치와 Pull Request는 기본 작업 흐름에 포함하지 않는다.
- 각 작업은 fetch 후 `dev`와 `origin/dev`가 같은 commit을 가리키는지, working tree와 HEAD가 예상 상태인지 확인한 뒤 시작한다.
- 특별한 사용자 지시가 없으면 agent는 push하지 않는다.
- fetch와 상태 조회는 가능하지만, 원격 ref를 변경하는 작업은 별도 사용자 지시가 필요하다.
- 작업 중에는 미공개 commit 때문에 로컬 `dev`가 일시적으로 `origin/dev`보다 앞설 수 있다. 작업 시작 전부터 뒤처졌거나 diverge한 상태면 임의로 통합하지 않고 중단해 보고한다.
- `origin/dev`에 공개된 commit은 불변으로 취급한다. 재구성 대상은 현재 이슈에서 만든 미공개 commit으로 제한한다.

## 3. GitHub triage 라벨 초기화

`docs/agents/triage-labels.md`는 라벨 이름과 의미를 정의하지만 GitHub에 라벨을 생성하지 않는다. 문서에 정의된 표준 라벨 중 원격 저장소에 없는 라벨은 최초 1회 생성한다.

현재 초기화 대상은 다음 네 개다.

- `needs-triage`
- `needs-info`
- `ready-for-agent`
- `ready-for-human`

이미 존재하는 라벨은 다시 만들거나 덮어쓰지 않는다. 생성 후 문서의 다섯 표준 라벨이 GitHub에 모두 존재하는지 조회해 확인한다.

## 4. 구현 중 후속 이슈 등록

### 4.1 판정

구현 중 발견한 항목은 현재 이슈의 acceptance criteria를 기준으로 분류한다.

| 판정 | 처리 |
| --- | --- |
| 현재 acceptance criteria 충족에 필수 | 현재 작업에서 처리 |
| 필수는 아니지만 문제와 기대 효과를 설명할 수 있음 | 후속 이슈로 즉시 등록 |
| 문제, 영향 또는 기대 결과가 아직 불명확함 | 임의 등록하지 않고 사용자 판단 요청 |

후속 이슈 등록은 현재 구현 범위를 자동으로 확장하지 않는다. 등록을 마치면 현재 작업을 계속하며, 새 이슈는 별도 승인 없이 구현하지 않는다.

### 4.2 등록 절차

1. 열린 이슈를 검색해 중복 여부를 확인한다.
2. 제목, 본문, 링크와 첨부 대상에서 공개 금지 정보를 검사한다.
3. 관찰한 문제, 영향, 현재 작업에서 제외하는 이유와 완료 조건을 기록한다.
4. `needs-triage` 라벨을 적용한다.
5. 현재 작업과 직접 연관되면 양쪽 이슈를 상호 참조한다.
6. 생성된 이슈 번호를 현재 작업의 완료 기록에 포함한다.

이 설계는 위 조건을 충족한 후속 이슈 생성만 반복 승인된 GitHub 쓰기 작업으로 정의한다. 생성된 후속 이슈의 할당, 추가 라벨 변경, 댓글, 종료와 다른 원격 변경까지 포괄 승인하지 않는다.

기능 설계에서 출발하는 일반 이슈는 기존 흐름대로 승인된 `docs/specs/` 문서를 근거로 생성한다. 구현 중 발견 이슈는 아직 승인 spec이 없는 예외이므로 `needs-triage` 상태에서 시작한다.

## 5. Checkpoint commit

### 5.1 작업 시작 고정점

현재 이슈를 시작할 때 다음 값을 기록한다.

- 시작 branch와 HEAD
- upstream과의 관계
- working tree 상태
- 현재 이슈의 commit 재구성 고정점

고정점 이전의 commit과 사용자 변경은 현재 이슈의 재구성 범위에 포함하지 않는다.

### 5.2 작업 중 commit

구현 중에는 검토 가능한 작은 checkpoint commit을 축적할 수 있다. 모든 commit은 `AGENTS.md`의 커밋 전 자동 정리 규칙을 따른다.

1. `git status --short`와 실제 diff 확인
2. `pnpm lint:fix && pnpm format` 실행
3. 실행 전후 상태와 diff 비교
4. 현재 commit 대상만 stage
5. `git diff --cached` 확인
6. `git diff --cached --check` 통과 확인
7. commit 생성

자동 수정으로 생긴 무관한 파일, 다른 이슈의 변경과 사용자 변경은 stage하지 않는다.

## 6. 최종 commit 재구성

### 6.1 원칙

- 이슈당 무조건 하나의 commit으로 squash하지 않는다.
- 독립적으로 이해하고 되돌릴 수 있는 논리 단위를 최종 commit 경계로 사용한다.
- 하나의 원자적 변경이면 하나의 최종 commit으로 만든다.
- `WIP`, `fixup!`, 리뷰 수정 전용 commit은 최종 이력에 남기지 않는다.
- 재구성 범위는 현재 이슈의 고정점 이후 미공개 commit으로 제한한다.

### 6.2 안전 절차

1. 재구성 전 HEAD를 로컬 안전 참조로 보존한다.
2. 현재 이슈 범위에서만 squash, reorder와 reword를 수행한다.
3. 재구성 전후 최종 tree가 동일한지 비교한다.
4. 각 최종 commit의 diff, 메시지와 논리적 독립성을 확인한다.
5. 전체 검증을 다시 실행한다.
6. 사용자가 push할 때까지 안전 참조를 유지한다.

위험도: 중간

롤백: 로컬 안전 참조 또는 reflog로 재구성 전 HEAD를 복구할 수 있다.

공개된 commit 재작성과 force push는 이 흐름에 포함하지 않는다. 재구성 결과가 일반 push로 전송될 수 없다면 중단하고 원인을 보고한다.

## 7. 완료 판정과 이슈 종료

### 7.1 종료 조건

다음 조건을 모두 충족해야 한다.

- acceptance criteria 전부 충족
- 관련 test, lint, typecheck와 build 검증 통과
- 최종 commit 재구성 완료
- 현재 이슈 범위의 diff와 commit 목록 확인
- 미해결 후속 작업의 이슈 등록 완료
- 공개 종료 댓글의 기밀 정보 검사 통과

push 완료 여부는 이슈 종료 조건이 아니다.

### 7.2 종료 절차

1. 현재 이슈 변경과 사용자·다른 작업의 변경을 분리 확인한다.
2. 최종 commit hash와 검증 명령·결과를 정리한다.
3. 후속 이슈 번호가 있으면 함께 기록한다.
4. 종료 댓글에 `로컬 완료, push 대기` 상태를 명시한다.
5. `gh issue close <번호> --comment "..."`로 현재 이슈를 종료한다.
6. push할 branch와 최종 commit 범위를 사용자에게 인계한다.

검증 실패, 미충족 acceptance criteria 또는 현재 범위에 필요한 미해결 결함이 있으면 commit을 재구성했더라도 이슈를 종료하지 않는다.

## 8. 문서 반영

승인 후 다음 운영 문서에 역할별로 반영한다.

- `AGENTS.md`: `dev`, worktree 금지, push 소유권과 후속 이슈 등록의 핵심 규칙
- `docs/agents/documentation.md`: 기존 기능 개발 흐름에 구현 중 발견 이슈 예외와 로컬 완료 기준 추가
- `docs/agents/issue-tracker.md`: 후속 이슈 판정·등록·종료 절차와 권한 범위
- `docs/agents/triage-labels.md`: 문서 정의와 GitHub 실제 라벨 초기화 책임 명시
- `docs/agents/development-workflow.md`: branch 초기화, commit 고정점, checkpoint, 재구성과 검증의 상세 절차

`AGENTS.md`에는 상세 절차를 복제하지 않고 `docs/agents/development-workflow.md` 링크만 둔다.

## 9. 포함 범위

- 로컬 `dev`와 `origin/dev` 초기화·운영 규칙
- worktree와 기능 브랜치를 사용하지 않는 기본 흐름
- 특별한 지시가 없을 때 사용자가 push를 소유하는 규칙
- 누락된 표준 triage 라벨 네 개의 GitHub 초기화
- 구현 중 발견한 범위 밖 작업의 `needs-triage` 이슈 등록
- checkpoint commit 축적과 미공개 commit 재구성
- 로컬 검증을 근거로 한 이슈 종료와 push 인계
- 관련 공통 운영 문서 갱신

## 10. 제외 범위

- 기능 코드 또는 제품 계약 변경
- worktree 생성
- 기능별 branch와 Pull Request 도입
- agent의 Git push, force push, publish 또는 배포
- 공개된 commit의 history rewrite
- 발견한 후속 이슈의 자동 구현
- 현재 설계와 무관한 기존 이슈·라벨 일괄 정리

## 11. 성공 조건

- 모든 구현 작업이 단일 로컬 `dev`에서 시작된다.
- 최초 `origin/dev` 생성과 이후 push는 사용자가 수행한다.
- 문서에 정의된 표준 triage 라벨 다섯 개가 GitHub에 존재한다.
- 현재 범위 밖의 구체적인 후속 작업이 `needs-triage` 이슈로 누락 없이 등록된다.
- 후속 이슈 등록이 현재 구현 범위를 확장하지 않는다.
- 최종 이력에 checkpoint 성격의 commit이 남지 않는다.
- 재구성 전후 최종 tree가 동일하고 전체 검증이 통과한다.
- 종료 댓글만으로 로컬 완료 상태, 검증 결과, 최종 commit과 후속 이슈를 확인할 수 있다.
- push되지 않은 상태임을 숨기지 않고 이슈를 종료한다.
- 사용자 변경, 다른 이슈 commit과 공개된 history가 보존된다.

## 12. 위험과 롤백

### Git history 재구성

위험도: 중간

롤백: 재구성 전 로컬 안전 참조와 reflog로 복구 가능

### GitHub 라벨 생성과 이슈 종료

위험도: 낮음

롤백: 잘못 만든 라벨은 사용 여부를 확인한 뒤 삭제할 수 있고, 잘못 종료한 이슈는 다시 열 수 있음

### 원격 dev 생성과 push

위험도: 중간

롤백: 일반 push된 commit은 revert로 되돌릴 수 있다. 원격 branch 삭제와 force push는 이 흐름에 포함하지 않으며 별도 명시 승인이 필요하다.
