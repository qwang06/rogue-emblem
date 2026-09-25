import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from './App.jsx';
import './ui.css';

// Renders synchronously so the page (and the #game element Phaser mounts
// into) is in the DOM by the time this returns.
export function mountUI(container) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
