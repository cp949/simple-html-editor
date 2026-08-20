import { createElement } from 'react';
import { HtmlEditor, type HtmlEditorHandle } from '@cp949/simple-html-editor-react';
import '@cp949/simple-html-editor-react/styles.css';

const handle: HtmlEditorHandle | null = null;

export const fixture = createElement(HtmlEditor, {
  ref: handle,
  value: '<p>서버 HTML</p>',
  onChange: (_html: string | undefined) => undefined,
});
