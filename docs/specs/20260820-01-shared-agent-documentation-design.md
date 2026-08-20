# 공통 Agent 문서 구조 설계

- 날짜: 2026-08-20
- 상태: approved
- 대상: 저장소 루트

## 1. 목적

모든 skill이 저장소 공통 문서와 승인된 용어를 같은 방식으로 찾고 사용하게 한다. 특정 skill 이름을 문서 경로에 포함하지 않으며, skill 설치본이나 plugin cache를 수정하지 않는다.

## 2. 결정

`AGENTS.md`를 모든 agent와 skill의 문서 라우터로 사용한다. 상세 문서 정책은 `docs/agents/documentation.md`에서 관리한다.

공통 구조는 다음과 같다.

```text
/
├── AGENTS.md
├── CONTEXT.md
└── docs/
    ├── agents/
    ├── specs/
    ├── product/
    ├── plans/
    ├── reviews/
    └── adr/
```

특정 skill의 기본 경로가 이 구조와 다르면 저장소의 `AGENTS.md`와 `docs/agents/documentation.md`가 우선한다.

## 3. 문서별 책임과 Git 정책

| 경로 | 책임 | Git 정책 |
| --- | --- | --- |
| `AGENTS.md` | 문서 위치, 탐색 순서와 skill 공통 규칙의 진입점 | 추적 |
| `CONTEXT.md` | 승인된 도메인 용어와 피해야 할 동의어 | 추적 |
| `docs/agents/` | issue tracker, triage, 도메인 탐색과 문서 운영 규칙 | 추적 |
| `docs/specs/` | 기능의 문제, 범위, 공개 계약, 중요 설계 결정과 성공 조건 | 추적 |
| `docs/product/` | 현재 제품이 제공하는 계약, 참조 자료와 생성된 현황 | 추적 |
| `docs/adr/` | 여러 기능에 적용되는 장기 아키텍처 결정 | 추적 |
| `docs/plans/` | 파일별 구현 순서, 테스트 명령과 실행 체크리스트 | 무시 |
| `docs/reviews/` | review finding, 판정, 검증 결과와 handoff | 무시 |

`docs/plans/`와 `docs/reviews/`는 현재 checkout에서 사용하는 로컬 작업 문서다. commit, stage 또는 배포 산출물에 포함하지 않는다.

`.superpowers/`는 필요할 경우 skill의 ignored runtime cache나 중간 snapshot에만 사용할 수 있다. 권위 문서, 승인 spec, 구현 plan 또는 최종 review의 저장 위치로 사용하지 않는다.

## 4. 작업 문서 파일명

날짜가 있는 작업 문서는 `YYYYMMDD-NN-<topic>-<kind>.md` 형식을 사용한다. `NN`은 같은 날짜에 `docs/specs/`에서 다음으로 사용할 수 있는 2자리 일련번호다. 번호를 발급한 spec과 그 구현 plan, review는 같은 작업 ID와 topic을 공유한다.

```text
docs/specs/20260820-01-shared-agent-documentation-design.md
docs/plans/20260820-01-shared-agent-documentation-plan.md
docs/reviews/20260820-01-shared-agent-documentation-review.md
```

일련번호는 문서가 폐기되거나 superseded돼도 재사용하지 않는다. `docs/product/`의 안정적인 제품 문서명과 `docs/adr/`의 별도 ADR 번호 체계에는 이 규칙을 강제하지 않는다.

## 5. 권위와 탐색 순서

agent와 skill은 작업 범위에 따라 다음 순서로 문서를 확인한다.

1. 직접 사용자 지시와 연결된 GitHub Issue
2. `AGENTS.md`
3. `CONTEXT.md` 또는 `CONTEXT-MAP.md`가 가리키는 관련 context
4. 관련 `docs/adr/`
5. 관련 `docs/product/`
6. 관련 `docs/specs/`
7. 현재 작업의 `docs/plans/`
8. 필요한 경우 `docs/reviews/`

충돌 시 직접 사용자 지시가 우선한다. `docs/reviews/`는 과거 판정과 검증 증거이며 spec이나 ADR을 덮어쓰지 않는다. 구현 중 장기 결정이 바뀌면 review에만 기록하지 않고 관련 spec 또는 ADR을 갱신해 승인을 받는다.

## 6. 기능 개발 생명주기

새 기능은 다음 흐름을 사용한다.

```text
브레인스토밍
  → docs/specs/YYYYMMDD-NN-<topic>-design.md proposed
  → 사용자 승인 후 approved
  → 승인 spec을 근거로 GitHub Issue 생성
  → docs/plans/YYYYMMDD-NN-<topic>-plan.md 작성
  → 구현과 테스트
  → docs/reviews/YYYYMMDD-NN-<topic>-review.md 작성
  → 완료 판정과 Issue 종료
```

GitHub Issue는 실행과 상태 추적을 담당한다. 승인 spec의 경로를 링크하고 acceptance criteria를 요약하되 spec 전체를 복제하지 않는다.

기능 하나에 국한된 설계 결정은 해당 spec에 둔다. 여러 기능이 따라야 하거나 이후 변경에서 반복해 참조할 장기 결정만 `docs/adr/`로 분리한다.

기능 완료 후 현재 제품의 계약이나 참조 정보가 바뀌면 관련 `docs/product/` 문서를 갱신한다. 생성 문서는 생성 명령과 수동 편집 가능 여부를 머리말에 명시한다.

## 7. Superpowers 경로 매핑

Superpowers가 제시하는 skill 전용 기본 경로는 다음처럼 바꿔 사용한다.

| Superpowers 기본값 | 저장소 공통 경로 |
| --- | --- |
| `docs/superpowers/specs/` | `docs/specs/` |
| `docs/superpowers/plans/` | `docs/plans/` |
| review report 또는 handoff | `docs/reviews/` |

Superpowers를 포함한 모든 skill은 새 문서를 만들기 전에 `AGENTS.md`의 경로 정책을 적용한다. plugin cache나 설치된 `SKILL.md`를 직접 수정하지 않는다.

## 8. 경로 이식성

공통 문서에는 작성자 컴퓨터의 절대 경로를 기록하지 않는다. 개발자마다 checkout 위치와 홈 디렉터리가 다르므로 Unix의 `/home/...`, `/work/...`, macOS의 `/Users/...`, Windows drive 경로와 `file://` URI를 금지한다.

저장소 내부 파일은 저장소 루트 기준 상대 경로로 작성한다.

```text
packages/react/dist
docs/specs/YYYYMMDD-NN-<topic>-design.md
```

외부 저장소나 도구가 절대 경로를 요구하면 실제 사용자 경로 대신 의미 있는 placeholder를 사용한다.

```text
<consumer-app-root>/<workspace>/package.json
<simple-html-editor-root>/packages/react/dist
```

명령 예시는 현재 위치 또는 `git rev-parse --show-toplevel`처럼 실행 시점에 경로를 해석하는 방식을 사용한다. `AGENTS.md`, `CONTEXT.md`, `README.md`와 `docs/**`의 공통 문서는 같은 규칙을 따른다. ignored runtime snapshot과 이관 전 역사 자료는 권위 문서가 아니며 신규 문서 작성의 예로 재사용하지 않는다.

## 9. 기존 문서 이관

기존 skill 전용 폴더를 일괄 이관하지 않는다. 현재 유효하고 승인된 spec만 검토 후 `docs/specs/`로 선별 이관한다.

현재 이관 후보는 다음과 같다.

- 기존 HTML 편집기 설계 → `docs/specs/20260820-02-html-editor-design.md`
- `docs/superpowers/specs/2026-08-20-dependency-upgrade-design.md` → `docs/specs/20260820-03-dependency-upgrade-design.md`

필요한 기존 plan과 review는 각각 ignored `docs/plans/`, `docs/reviews/`로 옮긴다. `.superpowers/**`의 snapshot, diff와 중간 보고서는 삭제하지 않고 역사 자료로 보존한다. 새 문서는 `docs/superpowers/`에 만들지 않는다.

## 10. 적용 범위

### 포함

- `AGENTS.md`의 공통 문서 routing 규칙
- `docs/agents/documentation.md`의 상세 운영 규칙
- `docs/specs/`, `docs/product/`, `docs/plans/`, `docs/reviews/`, `docs/adr/` 역할 정의
- 날짜별 일련번호와 작업 문서 간 공유 ID 규칙
- `.gitignore`의 local-only 문서 경로
- 현재 유효한 승인 spec의 선별 이관
- 공통 문서의 절대 로컬 경로 제거와 재발 방지

### 제외

- Superpowers 또는 Matt Pocock skill 설치본 수정
- plugin cache 수정
- 기존 `.superpowers/**` 역사 자료 삭제
- 모든 과거 plan과 review의 일괄 이관
- 이 설계만을 근거로 한 commit, push 또는 GitHub Issue 생성

## 11. 성공 조건

- `AGENTS.md`만 읽어도 모든 skill이 공통 문서 위치와 상세 정책 문서를 찾을 수 있다.
- Superpowers가 새 spec과 plan을 skill 전용 폴더에 만들지 않는다.
- `CONTEXT.md` 용어와 관련 ADR이 spec, plan, review보다 먼저 적용된다.
- `docs/specs/`, `docs/product/`, `docs/agents/`, `docs/adr/`는 Git에서 추적된다.
- `docs/plans/`, `docs/reviews/`, `.superpowers/`, `docs/superpowers/`는 Git에서 무시된다.
- 기존 유효 spec의 내용과 승인 상태가 이관 과정에서 유실되지 않는다.
- 같은 작업의 spec, plan과 review가 동일한 `YYYYMMDD-NN-<topic>` ID를 사용한다.
- 공통 문서에 개발자 컴퓨터의 구체적인 절대 경로가 남아 있지 않다.

## 12. 위험과 롤백

위험도: 낮음

주요 위험은 skill의 예시 경로를 권위 경로로 오해해 `docs/superpowers/`가 다시 생성되거나, ignored plan/review를 완료의 영구 증거로 오인하는 것이다. `AGENTS.md`에는 경로 override와 각 문서의 권위를 짧고 명시적으로 기록한다.

롤백: `AGENTS.md`, `.gitignore`, `docs/agents/documentation.md`와 이관된 spec만 path-scoped로 되돌릴 수 있다. ignored 기존 문서는 삭제하지 않으므로 이관 전 자료도 보존된다.
