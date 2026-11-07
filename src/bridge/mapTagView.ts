// Snapshots of the small tags React pins over map tiles (MapTags.tsx): the
// HP the enemies' intents threaten a unit with (src/game/battle/intents.ts),
// what a Shove being aimed would do (src/game/push.ts), and the damage the
// attack being aimed would do (the combat forecast). Plain frozen data;
// GridScene says where each tile shows on the canvas.

import type { IntentThreat } from '../game/battle/intents.ts';
import type { PushResult } from '../game/push.ts';
import type { CombatForecastView, TileAnchorView } from './views.ts';

// How a tag reads: a threat, a shove or an aimed attack that would fell
// its unit is 'lethal', other threats 'threat', the aimed attack's damage
// 'forecast', a shove that hurts 'hazard', and one that only moves (or
// can't) 'push'.
export type MapTagTone = 'threat' | 'lethal' | 'hazard' | 'push' | 'forecast';

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

// The HP the aimed attack would take off its target if every strike lands
// (the forecast's health before and after), over the target's tile: "KO"
// when that fells it, and 'forecast' toned, so it tells apart from an
// enemy's intent.
export function toForecastTagView(forecast: CombatForecastView): MapTagView {
  const { health, healthAfter } = forecast.defender;
  const damage = health - healthAfter;
  const lethal = healthAfter <= 0;
  return tagAt(
    'forecast',
    forecast.defenderAnchor,
    lethal ? `-${damage} KO` : `-${damage}`,
    lethal ? 'lethal' : 'forecast',
  );
}
