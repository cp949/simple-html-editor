import { createElement } from 'react';

import { HtmlEditor, type HtmlEditorHandle } from '@cp949/editor-simple';
import '@cp949/editor-simple/styles.css';

const handle: HtmlEditorHandle | null = null;

export const fixture = createElement(HtmlEditor, {
  ref: handle,
  value: '<p>서버 HTML</p>',
  onChange: (_html: string | undefined) => undefined,
});
