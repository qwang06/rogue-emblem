// Bosses with rules of their own, as data, and the pure rules that read
// it. A boss objective (objectives.ts) whose target is named after one of
// BOSS_RULES (its `title`) fights by that entry:
// - horn: on the enemy phase of every `every`th turn (the first, then
//   every `every` after) the boss sounds a war horn and marks a tile
//   beside it; at the next enemy phase a `unitClass` enemy of `level`
//   arrives there, unless a unit stands on the tile, which blocks it. At
//   most `limit` are called a battle.
// - enrage: once a hit leaves the boss at or under `below` of its max HP,
//   it gains `strength` STR and stops holding its ground.
// A boss without an entry (a region's generic "<Class> Chief") has no
// rules: it just holds its ground. The battle keeps a BossState for a
// boss with rules (battle/state.ts); battle/commands.ts applies them.
// No Phaser, no hidden state.

import { getWalkingDistances } from './enemySpawns.ts';
import { getCell, type Grid, type Point } from './grid.ts';
import type { Objective } from './objectives.ts';

export interface HornRule {
  every: number;
  unitClass: string;
  level: number;
  limit: number;
  // How many steps from the boss the marked tile may be.
  reach: number;
}

export interface EnrageRule {
  // The share of max HP (0–1) at or under which the boss enrages.
  below: number;
  strength: number;
}

export interface BossRules {
  id: string;
  // The boss's title, as a region names it (EnemyGroup.boss) and the
  // objective carries it, e.g. "Orc Warlord".
  title: string;
  // Its own name, for the name card: "Grukk".
  name: string;
  // The two lines it opens the battle with.
  taunt: readonly [string, string];
  horn?: HornRule;
  enrage?: EnrageRule;
}

export const ORC_WARLORD: BossRules = Object.freeze({
  id: 'orc-warlord',
  title: 'Orc Warlord',
  name: 'Grukk',
  taunt: Object.freeze([
    'So the little warband crawled all the way to my hold.',
    'Sound the horn! I want their banners for my tent.',
  ] as const),
  horn: Object.freeze({ every: 2, unitClass: 'goblin', level: 4, limit: 3, reach: 3 }),
  enrage: Object.freeze({ below: 0.5, strength: 3 }),
});

export const BOSS_RULES: readonly BossRules[] = Object.freeze([ORC_WARLORD]);

// The rules for a boss titled `title` (any case), or null for none.
export function findBossRules(title: string, rules: readonly BossRules[] = BOSS_RULES): BossRules | null {
  const wanted = title.trim().toLowerCase();
  return rules.find((entry) => entry.title.toLowerCase() === wanted) ?? null;
}

// The rules for a boss by id, or null for none.
export function getBossRules(id: string, rules: readonly BossRules[] = BOSS_RULES): BossRules | null {
  return rules.find((entry) => entry.id === id) ?? null;
}

// Where a boss with rules stands in its battle: which unit it is, which
// rules it plays (by id), whether it has enraged, the tile its horn marked
// for the next arrival (null for none), and how many its horn has called.
export interface BossState {
  readonly unitId: string;
  readonly rulesId: string;
  readonly enraged: boolean;
  readonly incoming: Point | null;
  readonly called: number;
}

// The state a battle with `objective` starts its boss in: null unless it's
// a boss objective whose target has rules.
export function createBossState(objective: Objective, rules: readonly BossRules[] = BOSS_RULES): BossState | null {
  if (objective.kind !== 'boss') return null;
  const entry = findBossRules(objective.name, rules);
  if (!entry) return null;
  return Object.freeze({ unitId: objective.unitId, rulesId: entry.id, enraged: false, incoming: null, called: 0 });
}

// Whether the horn sounds on `turn`'s enemy phase: on turn 1 and every
// `every` turns after, while fewer than `limit` have been called or
// marked.
export function isHornTurn(horn: HornRule, turn: number, boss: Pick<BossState, 'called' | 'incoming'>): boolean {
  const owed = boss.called + (boss.incoming ? 1 : 0);
  return owed < horn.limit && horn.every > 0 && (turn - 1) % horn.every === 0;
}

const key = ({ x, y }: Point) => `${x},${y}`;

// The tile the horn marks: the open walkable tile nearest the boss (on
// foot), within `reach` steps, northmost then westmost on a tie. Null when
// there's none.
export function pickHornTile(grid: Grid, bossAt: Point, reach: number): Point | null {
  const distances = getWalkingDistances(grid, [bossAt]);
  let best: { tile: Point; distance: number } | null = null;
  for (const cell of grid.cells) {
    const distance = distances.get(key(cell));
    if (distance === undefined || distance < 1 || distance > reach || cell.unitId) continue;
    if (!best || distance < best.distance) best = { tile: { x: cell.x, y: cell.y }, distance };
  }
  return best?.tile ?? null;
}

// Whether the tile the horn marked is free for its arrival: on the map,
// and nobody standing on it.
export function canArrive(grid: Grid, tile: Point): boolean {
  const cell = getCell(grid, tile.x, tile.y);
  return cell !== undefined && !cell.unitId;
}

// Whether a boss at `health` of `maxHealth` enrages now: it has the rule,
// it hasn't yet, and it's alive at or under the rule's share.
export function shouldEnrage(
  enrage: EnrageRule | undefined,
  boss: Pick<BossState, 'enraged'>,
  health: number,
  maxHealth: number,
): boolean {
  return !!enrage && !boss.enraged && health > 0 && health <= maxHealth * enrage.below;
}

// The unitId of the horn's `n`th arrival (1 is the first).
export function getHornUnitId(n: number): string {
  return `horn-${n}`;
}
