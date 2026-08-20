# 이슈 추적기: GitHub

이 저장소의 실행 이슈는 GitHub Issues에서 관리한다. 기능 설계는 `docs/specs/`에서 사용자 승인을 받은 뒤 GitHub Issue로 등록한다. Issue는 승인 spec의 저장소 상대 경로를 링크하고 acceptance criteria를 요약하며 spec 전체를 복제하지 않는다. 모든 GitHub 작업에는 `gh` CLI를 사용한다.

## 규칙

- **이슈 생성**: `gh issue create --title "..." --body "..."`. 본문이 여러 줄이면 heredoc을 사용한다.
- **이슈 조회**: `gh issue view <번호> --comments`를 사용하고, `jq`로 댓글을 필터링하며 라벨도 함께 조회한다.
- **이슈 목록 조회**: 적절한 `--label` 및 `--state` 필터와 함께 `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`를 사용한다.
- **이슈에 댓글 작성**: `gh issue comment <번호> --body "..."`
- **라벨 추가/제거**: `gh issue edit <번호> --add-label "..."` / `--remove-label "..."`
- **이슈 종료**: `gh issue close <번호> --comment "..."`

저장소는 `git remote -v`에서 판별한다. 저장소 clone 내부에서 실행하면 `gh`가 자동으로 판별한다.

## 구현 중 발견한 후속 작업

현재 이슈의 acceptance criteria에 필수인 항목은 현재 작업에서 처리한다. 필수는 아니지만 문제와 기대 효과를 구체적으로 설명할 수 있으면 다음 절차로 후속 이슈를 즉시 등록한다.

1. 열린 이슈에서 중복을 검색한다.
2. 제목, 본문, 링크와 첨부 대상에 `docs/agents/confidentiality.md`를 적용한다.
3. 관찰한 문제, 영향, 현재 범위에서 제외하는 이유와 완료 조건을 기록한다.
4. `needs-triage` 라벨을 적용한다.
5. 현재 작업과 직접 연관되면 이슈를 상호 참조한다.

문제나 기대 결과가 불명확하면 임의 등록하지 않고 사용자 판단을 요청한다. 생성된 후속 이슈는 현재 범위를 확장하지 않으며, 별도 승인 없이 구현하거나 할당·추가 변경·종료하지 않는다.

## 로컬 완료 이슈 종료

acceptance criteria, 관련 검증, 최종 commit 재구성과 후속 이슈 등록이 모두 완료되면 push 전에도 현재 이슈를 종료할 수 있다. 종료 댓글에는 다음 내용을 기록한다.

- `로컬 완료, push 대기` 상태
- 최종 commit hash
- 실행한 검증 명령과 결과
- 등록한 후속 이슈 번호

검증 실패나 미충족 acceptance criteria가 있으면 종료하지 않는다. 공개 금지 정보를 검사한 뒤 `gh issue close <번호> --comment "..."`를 사용한다.

## Pull request를 triage 요청 경로로 사용할지 여부

**PR을 요청 경로로 사용: 아니요.** _(이 저장소에서 외부 PR을 기능 요청으로 취급하려면 `예`로 변경한다. `/triage`는 이 값을 읽는다.)_

`예`로 설정하면 PR에도 이슈와 동일한 라벨 및 상태를 적용하며, 다음 `gh pr` 명령을 사용한다.

- **PR 조회**: `gh pr view <번호> --comments`로 내용과 댓글을 확인하고 `gh pr diff <번호>`로 diff를 확인한다.
- **외부 PR triage 목록 조회**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`를 실행한 뒤 `authorAssociation`이 `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, `NONE`인 항목만 유지한다. `OWNER`, `MEMBER`, `COLLABORATOR`는 제외한다.
- **댓글/라벨/종료**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`를 사용한다.

GitHub의 이슈와 PR은 번호 공간을 공유한다. 따라서 `#42`만으로는 종류를 알 수 없으므로 `gh pr view 42`를 먼저 실행하고, 실패하면 `gh issue view 42`를 실행한다.

## 스킬에서 "이슈 추적기에 게시"하라고 지시하는 경우

GitHub 이슈를 생성한다.

## 스킬에서 "관련 티켓을 가져오라"고 지시하는 경우

`gh issue view <번호> --comments`를 실행한다.

## Wayfinding 작업

`/wayfinder`에서 사용한다. **맵**은 하나의 이슈이며 **하위 이슈**를 티켓으로 사용한다.

- **맵**: Notes / Decisions-so-far / Fog 본문을 담고 `wayfinder:map` 라벨을 붙인 단일 이슈다. `gh issue create --label wayfinder:map`으로 생성한다.
- **하위 티켓**: GitHub sub-issues endpoint에 `gh api`를 호출해 맵의 하위 이슈로 연결한다. sub-issues를 사용할 수 없으면 맵 본문의 작업 목록에 하위 이슈를 추가하고, 하위 이슈 본문 맨 위에 `Part of #<맵 번호>`를 작성한다. `wayfinder:<유형>` 라벨(`research`/`prototype`/`grilling`/`task`)을 사용한다. 티켓을 맡으면 진행 개발자에게 할당한다.
- **차단 관계**: GitHub의 **native issue dependencies**를 표준이자 UI에 표시되는 표현으로 사용한다. `gh api --method POST repos/<소유자>/<저장소>/issues/<하위 이슈>/dependencies/blocked_by -F issue_id=<차단 이슈 DB ID>`로 관계를 추가한다. `<차단 이슈 DB ID>`는 `gh api repos/<소유자>/<저장소>/issues/<번호> --jq .id`로 얻는 숫자형 **database id**이며, `#번호`나 `node_id`가 아니다. GitHub의 `issue_dependencies_summary.blocked_by`는 열려 있는 차단 이슈 수를 나타내며 실제 진행 조건으로 사용한다. dependencies를 사용할 수 없으면 하위 이슈 본문 맨 위에 `Blocked by: #<번호>, #<번호>`를 작성한다. 모든 차단 이슈가 종료되면 해당 티켓의 차단이 해제된다.
- **진행 가능 티켓 조회**: 맵의 열린 하위 이슈를 맵의 sub-issues 또는 작업 목록 범위에서 `gh issue list --state open`으로 조회한다. 열린 차단 이슈가 있는 항목(`issue_dependencies_summary.blocked_by > 0` 또는 `Blocked by` 행이 가리키는 열린 이슈)과 이미 담당자가 있는 항목을 제외하고, 맵 순서상 첫 번째 항목을 선택한다.
- **담당 지정**: `gh issue edit <번호> --add-assignee @me`를 사용한다. 이 명령은 세션의 첫 번째 쓰기 작업이다.
- **해결**: `gh issue comment <번호> --body "<답변>"`으로 답변하고 `gh issue close <번호>`로 종료한 뒤, 컨텍스트 포인터(gist와 링크)를 맵의 Decisions-so-far에 추가한다.
