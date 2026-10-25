// Snapshots of a boss battle for React: the name card the boss stage opens
// with (BossIntro) and the big HP bar across the map while the boss lives
// (BossBar). A boss with rules (src/game/bosses.ts) is named by them and
// says its taunt; any other boss (a region's "<Class> Chief") shows its
// objective name alone. Plain frozen data.

import { findBossRules, type BossState } from '../game/bosses.ts';
import type { Objective } from '../game/objectives.ts';

// The name card: `name` big ("Grukk"), `title` under it ("Orc Warlord",
// or null when the boss has only the one name), and its taunt's lines.
// `id` changes per showing so React restarts its animation.
export interface BossIntroView {
  id: number;
  name: string;
  title: string | null;
  taunt: readonly string[];
  durationMs: number;
}

// The HP bar: who, how much health it has left (as the map shows it), and
// the rules' state: whether it has enraged, and whether its horn has marked
// a tile for a goblin to come.
export interface BossBarView {
  name: string;
  title: string | null;
  health: number;
  maxHealth: number;
  enraged: boolean;
  hornSounded: boolean;
}

// The boss's names: its rules' name and title, else the objective's name.
function getBossNames(objectiveName: string): { name: string; title: string | null; taunt: readonly string[] } {
  const rules = findBossRules(objectiveName);
  return rules
    ? { name: rules.name, title: rules.title, taunt: rules.taunt }
    : { name: objectiveName, title: null, taunt: [] };
}

// The name card for a battle with `objective`, or null when it isn't a
// boss battle.
export function toBossIntroView({
  id,
  objective,
  durationMs,
}: {
  id: number;
  objective: Objective;
  durationMs: number;
}): BossIntroView | null {
  if (objective.kind !== 'boss') return null;
  const { name, title, taunt } = getBossNames(objective.name);
  return Object.freeze({ id, name, title, taunt: Object.freeze([...taunt]), durationMs });
}

// The HP bar for a battle with `objective` whose boss is `unit` (undefined
// once it has fallen), at `health` when the map shows a hit ahead of the
// battle (else the unit's), with `boss` its rules' state. Null when it
// isn't a boss battle or the boss is gone.
export function toBossBarView(
  objective: Objective,
  boss: BossState | null,
  unit: { health: number; maxHealth: number } | undefined,
  health: number = unit?.health ?? 0,
): BossBarView | null {
  if (objective.kind !== 'boss' || !unit) return null;
  const { name, title } = getBossNames(objective.name);
  return Object.freeze({
    name,
    title,
    health: Math.max(0, Math.min(health, unit.maxHealth)),
    maxHealth: unit.maxHealth,
    enraged: boss?.enraged ?? false,
    hornSounded: boss?.incoming != null,
  });
}

// Whether two bars show the same thing, so the store only changes when
// the bar would.
export function isSameBossBar(a: BossBarView | null, b: BossBarView | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.name === b.name &&
    a.title === b.title &&
    a.health === b.health &&
    a.maxHealth === b.maxHealth &&
    a.enraged === b.enraged &&
    a.hornSounded === b.hornSounded
  );
}
