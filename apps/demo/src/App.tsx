import { HtmlEditor } from '@cp949/editor-simple';
import { useState } from 'react';

import { demoFixtures, initialServerHtml, type DemoFixture } from './fixtures';

/** 외부 raw HTML과 사용자 편집으로 얻은 모델 HTML을 구분하는 demo 저장 단위 */
type HtmlSnapshot = {
  html: string | undefined;
  needsNormalization: boolean;
};

const initialSnapshot: HtmlSnapshot = {
  html: initialServerHtml,
  needsNormalization: true,
};

/** 공개 HTML 편집기의 server load/save 흐름을 체험하는 demo 화면이다. */
export function App(): React.JSX.Element {
  const [currentSnapshot, setCurrentSnapshot] = useState<HtmlSnapshot>(initialSnapshot);
  const [serverSnapshot, setServerSnapshot] = useState<HtmlSnapshot>(initialSnapshot);

  // 현재 편집값과 별개로 보관한 server snapshot을 편집기에 적용한다.
  const loadFromServer = () => {
    setCurrentSnapshot(serverSnapshot);
  };

  // 저장은 현재 편집값만 server snapshot으로 바꾼다.
  const saveToServer = () => {
    setServerSnapshot(currentSnapshot);
  };

  // 선택 fixture는 모두 수기 외부 HTML이므로 실제 편집 전에는 저장하지 않는다.
  const loadFixture = (fixture: DemoFixture) => {
    setCurrentSnapshot({ html: fixture.html, needsNormalization: true });
  };

  // HtmlEditor의 onChange는 사용자 편집에서만 모델 HTML을 내보낸다.
  const handleChange = (html: string | undefined) => {
    setCurrentSnapshot({ html, needsNormalization: false });
  };

  return (
    <main className="demo-page">
      <header className="demo-page__header">
        <p className="demo-page__eyebrow">@cp949/editor-simple</p>
        <h1>HTML Editor Demo</h1>
        <p>공개 HtmlEditor와 library-owned stylesheet만 사용한 저장 흐름입니다.</p>
      </header>

      <section className="demo-page__fixtures" aria-label="HTML fixture">
        <h2>HTML fixture</h2>
        <div className="demo-page__actions">
          {demoFixtures.map((fixture) => (
            <button key={fixture.id} type="button" onClick={() => loadFixture(fixture)}>
              {fixture.label} fixture 불러오기
            </button>
          ))}
        </div>
      </section>

      <section className="demo-page__editor" aria-labelledby="editor-heading">
        <h2 id="editor-heading">현재 편집값</h2>
        <div className="demo-page__actions">
          <button type="button" onClick={loadFromServer}>
            서버에서 불러오기
          </button>
          <button
            type="button"
            onClick={saveToServer}
            disabled={currentSnapshot.needsNormalization}
          >
            서버에 저장
          </button>
          <button type="button" onClick={loadFromServer}>
            저장값 다시 불러오기
          </button>
        </div>
        {currentSnapshot.needsNormalization && (
          <p role="status">raw HTML은 직접 편집한 뒤 저장할 수 있습니다.</p>
        )}
        <HtmlEditor
          value={currentSnapshot.html}
          onChange={handleChange}
          placeholder="HTML 내용을 입력하세요"
        />
      </section>

      <section className="demo-page__status" aria-label="저장 상태">
        <h2>저장 상태</h2>
        <p>
          현재 편집값:{' '}
          {currentSnapshot.html === serverSnapshot.html
            ? '서버 저장값과 같습니다.'
            : '서버 저장값과 다릅니다.'}
        </p>
        <section aria-label="서버 저장 HTML">
          <pre>{serverSnapshot.html ?? '(빈 문서)'}</pre>
        </section>
      </section>
    </main>
  );
}
