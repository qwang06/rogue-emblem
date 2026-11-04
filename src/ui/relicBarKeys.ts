// The relic bar's keyboard browsing (RelicBar.tsx), as a pure step: Q opens
// it on the first relic (or the one last looked at), ←/→ (and ↑/↓) step
// through the relics, wrapping at the ends, Home/End jump to the first and
// last, and Q, Esc, X or Enter close it again. While it's open the bar
// swallows every key, so the map and overworld underneath don't move.

// The key that opens and closes the relic bar.
export const RELIC_BAR_KEY = 'q';

export type RelicBarStep =
  // Open, or stay open, on relic `index`.
  | { open: true; index: number }
  // Close the bar.
  | { open: false }
  // Leave things as they are and let the key through (the bar is closed).
  | null;

const CLOSE_KEYS = new Set(['Escape', 'x', 'X', 'Enter', 'z', 'Z']);

// What `key` does to the bar, open on relic `index` (or closed, with
// `index` the relic it last showed), holding `count` relics.
export function stepRelicBar(open: boolean, index: number, count: number, key: string): RelicBarStep {
  if (count === 0) return open ? { open: false } : null;
  const at = Math.min(Math.max(index, 0), count - 1);
  const toggle = key.toLowerCase() === RELIC_BAR_KEY;
  if (!open) return toggle ? { open: true, index: at } : null;
  if (toggle || CLOSE_KEYS.has(key)) return { open: false };
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return { open: true, index: (at - 1 + count) % count };
    case 'ArrowRight':
    case 'ArrowDown':
      return { open: true, index: (at + 1) % count };
    case 'Home':
      return { open: true, index: 0 };
    case 'End':
      return { open: true, index: count - 1 };
    default:
      return { open: true, index: at };
  }
}
