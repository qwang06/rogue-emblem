// Snapshots of the small tags React pins over map tiles (MapTags.tsx): the
// HP the enemies' intents threaten a unit with (src/game/battle/intents.ts),
// and what a Shove being aimed would do (src/game/push.ts). Plain frozen
// data; GridScene says where each tile shows on the canvas.

import type { IntentThreat } from '../game/battle/intents.ts';
import type { PushResult } from '../game/push.ts';
import type { TileAnchorView } from './views.ts';

// How a tag reads: a threat or a shove that would fell its unit is
// 'lethal', other threats 'threat', a shove that hurts 'hazard', and one
// that only moves (or can't) 'push'.
export type MapTagTone = 'threat' | 'lethal' | 'hazard' | 'push';

// One tag: `x` the middle and `y` the top of its tile, as fractions of the
// canvas (see toTileAnchorView), so it sits on the tile's top edge.
export interface MapTagView {
  id: string;
  x: number;
  y: number;
  text: string;
  tone: MapTagTone;
}

function tagAt(id: string, anchor: TileAnchorView, text: string, tone: MapTagTone): MapTagView {
  return Object.freeze({ id, x: (anchor.left + anchor.right) / 2, y: anchor.top, text, tone });
}

// The HP every planned strike on the unit would take if they all landed,
// "KO" when that's all it has.
export function toIntentTagView(threat: IntentThreat, anchor: TileAnchorView): MapTagView {
  const text = threat.lethal ? `-${threat.damage} KO` : `-${threat.damage}`;
  return tagAt(`intent-${threat.unitId}`, anchor, text, threat.lethal ? 'lethal' : 'threat');
}

// What a shove would do, in a word or two: the unit drowns, takes the
// spikes' or a bump's damage (each, when it slams into another unit), won't
// budge, or just slides. `health` is the shoved unit's.
export function describePush(push: PushResult, health: number): { text: string; tone: MapTagTone } {
  if (push.drowned) return { text: 'Drowns!', tone: 'lethal' };
  if (push.blocked === 'steadfast') return { text: "Won't budge", tone: 'push' };
  if (push.damage === 0) return { text: 'Shove', tone: 'push' };
  const what = push.hazard ? 'Spikes' : push.collidedId ? 'Bump both' : 'Bump';
  if (push.damage >= health) return { text: `${what} -${push.damage} KO`, tone: 'lethal' };
  return { text: `${what} -${push.damage}`, tone: 'hazard' };
}

// The tag over the tile a shove leaves its unit on (see describePush).
export function toPushTagView(push: PushResult, health: number, anchor: TileAnchorView): MapTagView {
  const { text, tone } = describePush(push, health);
  return tagAt('push', anchor, text, tone);
}
