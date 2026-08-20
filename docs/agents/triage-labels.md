# Triage 라벨

스킬은 다섯 가지 표준 triage 역할을 사용한다. 이 문서는 각 역할을 이 저장소의 이슈 추적기에서 사용하는 실제 라벨 문자열에 매핑한다.

| mattpocock/skills의 라벨 | 이 저장소의 라벨 | 의미 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 관리자가 이슈를 검토해야 함 |
| `needs-info` | `needs-info` | 제보자의 추가 정보를 기다리는 중 |
| `ready-for-agent` | `ready-for-agent` | 명세가 완료되어 AFK 에이전트가 처리할 수 있음 |
| `ready-for-human` | `ready-for-human` | 사람의 구현이 필요함 |
| `wontfix` | `wontfix` | 처리하지 않기로 결정함 |

스킬이 역할을 언급하면(예: "AFK 처리 가능 triage 라벨을 적용") 이 표에서 대응하는 라벨 문자열을 사용한다.

실제 사용하는 라벨 명칭이 달라지면 오른쪽 열을 수정한다.

## GitHub 초기화

이 표는 라벨 이름과 의미를 정의하며 GitHub 라벨을 자동 생성하지 않는다. 저장소 초기화나 라벨 변경 시 `gh label list`로 실제 상태를 확인하고, 표준 라벨 중 없는 항목만 `gh label create`로 생성한다. 이미 존재하는 라벨은 임의로 덮어쓰지 않는다.
