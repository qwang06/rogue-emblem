// Painted battlefields (see src/game/battlefields.ts): one picture per
// field kind, floor and scenery in one, drawn under the arena in place of
// the code-drawn look (BATTLEFIELD_LOOKS in src/game/backdrop.ts). A kind
// without one keeps the code-drawn look. `size` is the picture's [width,
// height] in its own pixels and `field` the rectangle of it ([x, y, width,
// height]) the arena's floor is laid over: the open ground left clear for
// the fight, as wide for its height as a BATTLEFIELD_SIZE floor of CELLs.
import plains from './battlefields/plains.webp';
import type { BattlefieldKind } from '../game/battlefields.ts';
import type { Painting } from '../game/backdrop.ts';

export const BATTLEFIELD_PAINTINGS: Readonly<Partial<Record<BattlefieldKind, Painting & { url: string }>>> =
  Object.freeze({
    plains: { url: plains, size: [3840, 2160], field: [720, 580, 2400, 1072] },
  });

// The texture key a battlefield's painting loads under.
export function battlefieldPaintingKey(kind: BattlefieldKind): string {
  return `battlefield-${kind}`;
}
