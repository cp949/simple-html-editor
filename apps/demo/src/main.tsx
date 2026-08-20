import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@cp949/editor-simple/styles.css';

import { App } from './App';
import './app.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('demo root element를 찾을 수 없습니다.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
