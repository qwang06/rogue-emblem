import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the build works when served from a subpath,
  // e.g. GitHub Pages at https://<user>.github.io/rogue-emblem/.
  base: './',
  server: {
    // Don't auto-open a new tab on every dev server start — Vite has no way
    // to detect a tab that's already open with the game. Open it once
    // yourself; Vite's dev client auto-reconnects and refreshes that tab
    // whenever the server restarts.
    open: false,
  },
});
