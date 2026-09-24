import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './ui.css';

export function mountUI(container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
