import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Don't auto-open a new tab on every dev server start — Vite has no way
    // to detect a tab that's already open with the game. Open it once
    // yourself; Vite's dev client auto-reconnects and refreshes that tab
    // whenever the server restarts.
    open: false,
  },
});
