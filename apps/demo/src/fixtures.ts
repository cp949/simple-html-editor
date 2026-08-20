/** 공개 HTML 편집기의 정규화 결과를 확인하는 demo 입력 모음이다. */

/** 일반적인 소비자 본문 형태와 허용되지 않는 속성을 함께 담은 입력 */
export const introHtml = `
  <div class="legacy" onclick="alert('container')">
    <p>음성인식(STT)은 <strong onclick="alert('strong')">음성을</strong>
      <span style="color: #0047b2; background-image: url(https://evil.example/a)">텍스트로 바꿉니다.</span>
    </p>
    <script type="text/plain">alert('script')</script>
  </div>
`;

/** 제목, 목록, 링크와 정렬 지원 범위를 보이는 입력 */
export const formattingHtml = `
  <h1>HTML 편집기 demo</h1>
  <h2>서식과 정렬</h2>
  <p><a href="https://consumer.example/help">도움말 링크</a>와 <u>밑줄</u>, <s>취소선</s>을 지원합니다.</p>
  <ol><li><p>번호 목록</p></li><li><p>두 번째 항목</p></li></ol>
  <ul><li><p>글머리 목록</p></li><li><p>두 번째 항목</p></li></ul>
  <p style="text-align: center">가운데 정렬 문단</p>
  <p style="text-align: right">오른쪽 정렬 문단</p>
`;

/** bitmap data URL 이미지 삽입 방법을 설명하는 입력 */
export const imageInstructionsHtml = `
  <h2>data URL 이미지</h2>
  <p>이미지 추가 버튼에서 파일을 고르거나 <code>data:image/png;base64,...</code> 형식의 bitmap data URL을 붙여 넣으세요.</p>
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="크기 조절 demo 이미지" width="160">
`;

/** 표 조작 control을 확인하는 입력 */
export const tableHtml = `
  <h2>표</h2>
  <table>
    <thead><tr><th><p>항목</p></th><th><p>설명</p></th></tr></thead>
    <tbody>
      <tr><td><p>첫 번째</p></td><td><p>표 cell은 테두리로 구분됩니다.</p></td></tr>
      <tr><td><p>두 번째</p></td><td><p>행과 열을 추가하거나 삭제할 수 있습니다.</p></td></tr>
    </tbody>
  </table>
`;

/** 실행 가능한 markup이 제거되는지 보여 주는 입력 */
export const unsafeHtml = `
  <h2>안전하지 않은 HTML</h2>
  <p onclick="alert('event')" style="font-size: 72px; background-image: url(https://evil.example/a)">event handler와 지원하지 않는 style은 제거됩니다.</p>
  <a href="javascript:alert('link')">javascript URL은 링크로 유지되지 않습니다.</a>
  <script>alert('script')</script>
`;

/** demo가 editor에 전달하는 정규화된 fixture 모델 */
export type DemoFixture = {
  /** fixture 선택 control의 안정 식별자 */
  id: 'intro' | 'formatting' | 'image' | 'table' | 'unsafe';

  /** fixture 선택 control에 표시할 이름 */
  label: string;

  /** HtmlEditor에 전달할 HTML source */
  html: string;
};

/** 모두 수기 외부 HTML인 demo 선택 fixture */
export const demoFixtures: readonly DemoFixture[] = [
  { id: 'intro', label: 'intro', html: introHtml },
  { id: 'formatting', label: '서식', html: [formattingHtml, tableHtml].join('\n') },
  { id: 'image', label: '이미지', html: imageInstructionsHtml },
  { id: 'table', label: '표', html: tableHtml },
  { id: 'unsafe', label: 'unsafe', html: unsafeHtml },
];

/** demo 서버의 초기 저장값 */
export const initialServerHtml = demoFixtures[0].html;
