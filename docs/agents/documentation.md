# 공통 문서 운영

모든 agent와 skill이 같은 문서 구조, 승인된 용어와 권위 관계를 사용하기 위한 저장소 공통 규칙이다. 특정 skill의 기본 문서 경로보다 이 문서가 우선한다.

## 문서 역할과 Git 정책

| 경로 | 책임 | Git 정책 |
| --- | --- | --- |
| `AGENTS.md` | 공통 문서와 agent 운영 규칙의 진입점 | 추적 |
| `CONTEXT.md` | 승인된 도메인 용어와 피해야 할 동의어 | 추적 |
| `docs/agents/` | issue tracker, triage, 도메인 탐색과 문서 운영 규칙 | 추적 |
| `docs/specs/` | 기능의 문제, 범위, 공개 계약, 중요 설계 결정과 성공 조건 | 추적 |
| `docs/product/` | 현재 제품이 제공하는 계약, 참조 자료와 생성 현황 | 추적 |
| `docs/adr/` | 여러 기능이 따르는 장기 아키텍처 결정 | 추적 |
| `docs/plans/` | 파일별 구현 순서, 테스트 명령과 실행 체크리스트 | 무시 |
| `docs/reviews/` | review finding, 판정, 검증 결과와 handoff | 무시 |

`.superpowers/`는 필요할 경우 ignored runtime cache나 중간 snapshot에만 사용한다. 권위 문서, 승인 spec, 구현 plan 또는 최종 review를 `.superpowers/`나 `docs/superpowers/`에 새로 작성하지 않는다.

## 작업 문서 파일명

날짜가 있는 작업 문서는 `YYYYMMDD-NN-<topic>-<kind>.md` 형식을 사용한다.

- `NN`은 같은 날짜에 `docs/specs/`에서 다음으로 사용할 수 있는 2자리 일련번호다.
- spec에서 발급한 날짜, 일련번호와 topic을 관련 plan과 review가 공유한다.
- kind는 spec의 `design`, plan의 `plan`, review의 `review`처럼 문서 역할을 나타낸다.
- 폐기되거나 superseded된 번호는 재사용하지 않는다.
- `docs/product/`의 안정적인 파일명과 `docs/adr/`의 ADR 번호 체계에는 이 규칙을 강제하지 않는다.

예:

```text
docs/specs/20260820-01-shared-agent-documentation-design.md
docs/plans/20260820-01-shared-agent-documentation-plan.md
docs/reviews/20260820-01-shared-agent-documentation-review.md
```

## 문서 탐색과 권위

작업을 시작할 때 범위에 맞는 문서를 다음 순서로 확인한다.

1. 직접 사용자 지시와 연결된 GitHub Issue
2. `AGENTS.md`
3. `CONTEXT.md` 또는 `CONTEXT-MAP.md`가 가리키는 관련 context
4. 관련 `docs/adr/`
5. 관련 `docs/product/`
6. 관련 `docs/specs/`
7. 현재 작업의 `docs/plans/`
8. 필요한 경우 `docs/reviews/`

문서들은 서로 다른 책임을 가지므로 단순히 최신 파일이 다른 문서를 덮어쓰지 않는다. 직접 사용자 지시가 기존 결정과 충돌하면 충돌을 알리고 갱신 대상을 확인한다. review는 과거 판정과 검증 증거이며 spec이나 ADR을 덮어쓰지 않는다. 구현 중 장기 결정이 바뀌면 review에만 기록하지 않고 관련 spec 또는 ADR을 갱신해 승인을 받는다.

## 기능 개발 흐름

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

GitHub Issue는 실행과 상태 추적을 담당한다. 승인 spec의 저장소 상대 경로를 링크하고 acceptance criteria를 요약하되 spec 전체를 복제하지 않는다.

기능 하나에 국한된 설계 결정은 해당 spec에 둔다. 여러 기능이 따라야 하거나 이후 변경에서 반복해 참조할 장기 결정만 `docs/adr/`로 분리한다. 기능 완료 후 현재 제품 계약이나 참조 정보가 바뀌면 관련 `docs/product/` 문서를 갱신한다. 생성 문서는 생성 명령과 수동 편집 가능 여부를 머리말에 명시한다.

## Skill 경로 override

모든 skill은 다음 공통 경로를 사용한다.

| 산출물 | 공통 경로 |
| --- | --- |
| spec 또는 design | `docs/specs/` |
| implementation plan | `docs/plans/` |
| review, verification report 또는 handoff | `docs/reviews/` |

Superpowers가 제시하는 `docs/superpowers/specs/`와 `docs/superpowers/plans/`는 이 저장소에서 사용하지 않는다. skill 설치본이나 plugin cache를 수정하지 않고 이 저장소의 `AGENTS.md`와 이 문서로 경로를 override한다.

## 경로 이식성

공통 문서에는 개발자 컴퓨터의 구체적인 절대 경로를 기록하지 않는다.

- 저장소 내부 파일은 저장소 루트 기준 상대 경로로 작성한다.
- 외부 checkout이나 도구가 절대 경로를 요구하면 `<repository-root>` 형태의 의미 있는 placeholder를 사용한다.
- 명령 예시는 현재 위치 또는 실행 시점에 저장소 루트를 해석하는 방식을 사용한다.
- Unix, macOS, Windows의 구체적인 사용자 경로와 file URI를 기록하지 않는다.

```text
packages/react/dist
<consumer-app-root>/<workspace>/package.json
```

이 규칙은 `AGENTS.md`, `CONTEXT.md`, `README.md`와 `docs/**`의 공통 문서에 적용한다. ignored runtime snapshot과 이관 전 역사 자료는 권위 문서가 아니며 신규 문서의 예로 재사용하지 않는다.
