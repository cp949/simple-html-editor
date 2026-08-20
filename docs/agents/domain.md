# 도메인 문서

엔지니어링 스킬이 코드베이스를 탐색할 때 이 저장소의 도메인 문서를 읽는 방법을 정의한다.

## 탐색 전에 읽을 문서

- 저장소 루트의 **`CONTEXT.md`**, 또는
- 저장소 루트에 **`CONTEXT-MAP.md`**가 있다면 이 파일. `CONTEXT-MAP.md`는 컨텍스트별 `CONTEXT.md`를 가리킨다. 작업 주제와 관련된 파일을 각각 읽는다.
- **`docs/adr/`**에서 작업 영역과 관련된 ADR을 읽는다. 다중 컨텍스트 저장소라면 `src/<컨텍스트>/docs/adr/`의 컨텍스트별 결정도 확인한다.

해당 파일이 없으면 **별도 보고 없이 계속 진행한다**. 파일이 없다는 사실을 문제로 제기하거나 미리 생성을 제안하지 않는다. `/grill-with-docs`와 `/improve-codebase-architecture`를 통해 호출되는 `/domain-modeling` 스킬이 실제 용어나 결정이 확정될 때 문서를 지연 생성한다.

## 파일 구조

이 저장소는 HTML 편집기 라이브러리, demo와 소비 검증 fixture를 하나의 용어집으로 설명하는 단일 컨텍스트 구조를 사용한다.

```text
/
├── CONTEXT.md
├── apps/demo/
├── fixtures/consumer/
├── packages/core/
├── packages/react/
└── docs/adr/                          ← 결정이 생길 때만 생성
```

다중 컨텍스트 저장소는 루트에 `CONTEXT-MAP.md`가 있는 다음 구조를 사용한다.

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 시스템 전체 결정
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← 컨텍스트별 결정
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 용어집의 어휘 사용

출력에서 도메인 개념을 명명할 때(이슈 제목, 리팩터링 제안, 가설, 테스트 이름 등) `CONTEXT.md`에 정의된 용어를 사용한다. 용어집에서 피하도록 명시한 동의어로 바꾸지 않는다.

필요한 개념이 용어집에 없다면 신호로 받아들인다. 프로젝트에서 사용하지 않는 언어를 새로 만들고 있는 것인지 다시 검토하거나, 실제 공백이라면 `/domain-modeling`에서 다룰 내용으로 기록한다.

## ADR 충돌 보고

출력이 기존 ADR과 충돌하면 조용히 덮어쓰지 말고 명시적으로 알린다.

> _ADR-0007(이벤트 소싱 주문)과 충돌하지만, 다음 이유로 재검토할 가치가 있음: …_
