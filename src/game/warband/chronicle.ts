// A Warband Mode run's chronicle: what happened over the run, kept for the
// recap when it ends (runSummary.ts). Each battle adds its kills, who fell
// and on which stage, whether it beat a boss and how long it took, and the
// time spent at camp adds to the play time. Plain JSON, so it saves with
// the run; every function returns a new frozen chronicle.

export interface RunChronicle {
  // Enemies felled over the run, by the unitId of the unit that felled them.
  kills: Readonly<Record<string, number>>;
  // The stage each fallen unit fell on, by unitId.
  fallenOn: Readonly<Record<string, number>>;
  // Boss stages won.
  bossesDefeated: number;
  // Time spent playing the run, in milliseconds.
  playMs: number;
}

export const EMPTY_CHRONICLE: RunChronicle = freezeChronicle({ kills: {}, fallenOn: {}, bossesDefeated: 0, playMs: 0 });

// What one battle adds to the chronicle.
export interface ChronicleBattle {
  // The stage the battle was fought on.
  stage: number;
  // Kills in the battle by unitId; only `unitIds`' are counted.
  kills: ReadonlyMap<string, number>;
  // The warband's units that fought, whose kills count.
  unitIds: readonly string[];
  // The warband's units that died in the battle.
  fallenIds: readonly string[];
  bossDefeated: boolean;
  elapsedMs: number;
}

// The chronicle with `battle` added.
export function recordBattle(chronicle: RunChronicle, battle: ChronicleBattle): RunChronicle {
  const kills = { ...chronicle.kills };
  for (const unitId of battle.unitIds) {
    const count = battle.kills.get(unitId) ?? 0;
    if (count > 0) kills[unitId] = (kills[unitId] ?? 0) + count;
  }
  const fallenOn = { ...chronicle.fallenOn };
  for (const unitId of battle.fallenIds) fallenOn[unitId] = battle.stage;
  return freezeChronicle({
    kills,
    fallenOn,
    bossesDefeated: chronicle.bossesDefeated + (battle.bossDefeated ? 1 : 0),
    playMs: chronicle.playMs + toPlayMs(battle.elapsedMs),
  });
}

// The chronicle with `elapsedMs` more play time (time spent at camp).
export function addPlayTime(chronicle: RunChronicle, elapsedMs: number): RunChronicle {
  return freezeChronicle({ ...chronicle, playMs: chronicle.playMs + toPlayMs(elapsedMs) });
}

// The chronicle in `value` (as saved with a run), or null if it isn't one.
export function parseChronicle(value: unknown): RunChronicle | null {
  if (!isRecord(value)) return null;
  const { kills, fallenOn, bossesDefeated, playMs } = value;
  if (!isCounts(kills) || !isCounts(fallenOn) || !isWholeNumber(bossesDefeated) || !isWholeNumber(playMs)) return null;
  return freezeChronicle({ kills, fallenOn, bossesDefeated, playMs });
}

// Negative, fractional or non-finite times (a clock that jumped) count as
// whole milliseconds, never less than none.
function toPlayMs(elapsedMs: number): number {
  return Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : 0;
}

function isCounts(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isWholeNumber);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function freezeChronicle(chronicle: RunChronicle): RunChronicle {
  return Object.freeze({
    ...chronicle,
    kills: Object.freeze({ ...chronicle.kills }),
    fallenOn: Object.freeze({ ...chronicle.fallenOn }),
  });
}
