# 공개 저장소 기밀 정보

공개 저장소의 파일, Git history와 GitHub 산출물에 사내 프로젝트를 식별할 수 있는 이름, 경로 또는 구현 세부사항을 포함하지 않는다.

## 공개 표현

- 외부 사용처는 `소비자` 또는 `consumer application`으로 표현한다.
- fixture는 `consumer fixture`처럼 비식별 이름을 사용한다.
- 외부 checkout 경로가 필요하면 `<consumer-app-root>`처럼 의미만 나타내는 placeholder를 사용한다.

## 금지 정보

- 실제 사내 프로젝트명과 저장소명
- 사내 프로젝트의 내부 경로와 내부 컴포넌트명
- 공개 계약을 설명하는 데 필요하지 않은 조직·서비스 식별 정보
- 위 정보를 포함하는 URL, 스크린샷, 로그와 첨부파일

이 규칙은 tracked 파일, commit message, GitHub Issue, Pull Request, 댓글, 라벨, 링크와 첨부파일에 모두 적용한다.

## 검사와 대응

- 실제 차단 식별자는 공개 저장소에 문자열로 기록하지 않고 로컬 전용 입력으로 관리한다.
- 공개 GitHub 산출물을 만들기 전에 제목, 본문, 댓글, 링크와 첨부파일을 검사한다.
- 유출이 확인되면 추가 push를 중단하고 원격 공개 범위, Git history, fork와 cache 영향을 확인한다.
- 단순 삭제 commit은 과거 history를 제거하지 않으므로 필요한 경우 정제된 history로 교체한다.
- 정제 전 history를 보관해야 하면 ignored 로컬 bundle로만 관리하고 원격 ref로 전송하지 않는다.
