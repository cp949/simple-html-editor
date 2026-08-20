# 개발 작업 흐름

모든 구현 작업은 단일 로컬 `dev`에서 수행한다. branch, commit, push와 완료 판정의 상세 절차를 이 문서가 소유한다.

## 작업 시작

1. `git status --short --branch`로 branch와 working tree를 확인한다.
2. `git rev-parse HEAD`와 upstream을 기록해 현재 이슈의 고정점을 정한다.
3. 현재 branch가 `dev`인지 확인한다.
4. 사용자 변경과 다른 이슈의 미공개 commit을 현재 범위에서 제외한다.

최초 로컬 `dev`는 upstream 없이 `origin/main`에서 만든다. 원격 `origin/dev`가 없으면 원칙적으로 사용자가 `git push -u origin dev`로 생성하고, 사용자가 별도로 명시한 경우에만 agent가 수행한다. 최초 push 후 로컬 `dev`는 `origin/dev`를 추적하고 같은 commit을 가리켜야 한다. 특별한 지시가 없으면 agent는 push하지 않는다. worktree, 기능별 branch와 Pull Request는 기본 흐름에 포함하지 않는다.

## Checkpoint commit

작업 중에는 검토 가능한 작은 commit을 축적할 수 있다. 모든 commit 직전에 `AGENTS.md`의 자동 정리를 실행하고 현재 commit 대상만 stage한다. 사용자 변경, 다른 이슈와 자동 정리로 생긴 무관한 변경을 섞지 않는다.

## 최종 commit 재구성

현재 이슈의 고정점 이후 미공개 commit만 재구성한다. `origin/dev`에 존재하는 commit은 불변이다.

1. 재구성 전 HEAD를 로컬 안전 참조로 보존한다.
2. 독립적으로 이해하고 되돌릴 수 있는 논리 단위로 squash, reorder와 reword한다.
3. `WIP`, `fixup!`와 리뷰 수정 전용 commit을 제거한다.
4. 재구성 전후 tree가 같은지 확인한다.
5. 각 최종 commit의 diff와 메시지를 확인하고 전체 검증을 다시 실행한다.
6. 사용자가 push할 때까지 안전 참조를 유지한다.

위험도: 중간

롤백: 로컬 안전 참조 또는 reflog로 재구성 전 HEAD를 복구할 수 있다.

공개된 commit 재작성과 force push는 금지한다. 재구성 결과를 일반 push할 수 없으면 중단하고 보고한다.

## 완료와 인계

acceptance criteria, 관련 검증, 최종 commit 재구성과 후속 이슈 등록이 모두 끝나야 로컬 완료다. push는 완료 조건이 아니며 종료 기록에 `로컬 완료, push 대기`를 명시한다. 최종 branch, commit 범위와 사용자가 실행할 push 명령을 인계한다.
