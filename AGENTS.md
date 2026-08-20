## 커밋 전 자동 정리

모든 커밋 직전에 다음 명령을 실행한다.

```bash
pnpm lint:fix && pnpm format
```

실행 전후 `git status --short`와 실제 diff를 비교한다. 자동 수정으로 변경 범위가 넓어질 수 있으므로 기존 사용자 변경과 무관한 파일을 임의로 stage하지 않는다.

명령이 성공한 뒤 커밋 대상만 stage하고, `git diff --cached`와 `git diff --cached --check`를 확인한 후 커밋한다. 명령이 실패하면 커밋하지 않고 실패 원인을 보고한다.

## Agent skills

### 공통 문서 구조

모든 skill은 문서를 만들거나 읽기 전에 `docs/agents/documentation.md`를 따른다.
특정 skill의 기본 경로보다 이 저장소의 공통 경로가 우선한다.
저장소 문서에는 개발자 컴퓨터의 구체적인 절대 경로를 기록하지 않는다.

### 이슈 추적기

이슈는 `cp949/simple-html-editor`의 GitHub Issues에서 관리한다. 자세한 내용은 `docs/agents/issue-tracker.md`를 참고한다.

### 기밀 정보

공개 저장소와 GitHub 산출물에는 사내 프로젝트를 식별할 수 있는 정보를 기록하지 않는다. 자세한 내용은 `docs/agents/confidentiality.md`를 참고한다.

### Triage 라벨

이 저장소에서는 다섯 가지 표준 triage 라벨을 사용한다. 자세한 내용은 `docs/agents/triage-labels.md`를 참고한다.

### 도메인 문서

이 저장소는 단일 컨텍스트 구조를 사용한다. 자세한 내용은 `docs/agents/domain.md`를 참고한다.
도메인 개념을 명명할 때는 루트 `CONTEXT.md`의 승인된 용어를 그대로 사용한다.
