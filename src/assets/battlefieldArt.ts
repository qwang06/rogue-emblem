// Painted battlefields (see src/game/battlefields.ts): one picture per
// field kind, floor and backdrop in one, drawn under the arena in place of
// the code-drawn look (BATTLEFIELD_LOOKS in src/game/backdrop.ts). A kind
// without one keeps the code-drawn look. `horizon` is the row of the
// picture where its floor starts (the foot of its far scenery), in the
// picture's own pixels, and `size` its [width, height].
import plains from './battlefields/plains.webp';
import type { BattlefieldKind } from '../game/battlefields.ts';
import type { Painting } from '../game/backdrop.ts';

export const BATTLEFIELD_PAINTINGS: Readonly<Partial<Record<BattlefieldKind, Painting & { url: string }>>> =
  Object.freeze({
    plains: { url: plains, size: [1200, 896], horizon: 170 },
  });

// The texture key a battlefield's painting loads under.
export function battlefieldPaintingKey(kind: BattlefieldKind): string {
  return `battlefield-${kind}`;
}
