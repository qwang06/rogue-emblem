// The recap of a Warband Mode run that has ended, fallen or won: how far
// it got, how long it took, its most valuable unit, a memorial for each
// unit lost and the relics it held, read off the run and its chronicle
// (chronicle.ts). The renown it earns is meta.ts's business.

import { EMPTY_CHRONICLE } from './chronicle.ts';
import type { RunState, UnitSnapshot } from './run.ts';

// A unit as the recap names it.
export interface SummaryUnit {
  id: string;
  name: string;
  classId: string;
  level: number;
  kills: number;
}

// A fallen unit and the stage it fell on (null when the run didn't record
// it, in a run saved before the chronicle was kept).
export interface MemorialEntry extends SummaryUnit {
  stage: number | null;
}

export interface RunSummary {
  won: boolean;
  // The stage the run ended on: the one it fell on, or the final stage.
  stage: number;
  // Stages won: every stage before the last, plus the last if it was won.
  stagesCleared: number;
  bossesDefeated: number;
  playMs: number;
  // Every enemy felled by the warband over the run.
  kills: number;
  // The unit with the most kills, living or fallen (the earliest on the
  // roster on a tie, the living first), or null when nobody felled anything.
  mvp: SummaryUnit | null;
  // The units still standing, in roster order.
  survivors: readonly SummaryUnit[];
  // The units lost, in the order they fell.
  memorial: readonly MemorialEntry[];
  // The relic ids the run held.
  relics: readonly string[];
}

// The recap of `run`, which has ended (`won` or fallen).
export function summarizeRun(run: RunState, won: boolean): RunSummary {
  const chronicle = run.chronicle ?? EMPTY_CHRONICLE;
  const toUnit = (unit: UnitSnapshot): SummaryUnit =>
    Object.freeze({
      id: unit.id,
      name: unit.name,
      classId: unit.classId,
      level: unit.level,
      kills: chronicle.kills[unit.id] ?? 0,
    });
  const survivors = run.roster.map(toUnit);
  const memorial = run.fallen.map((unit) =>
    Object.freeze({ ...toUnit(unit), stage: chronicle.fallenOn[unit.id] ?? null }),
  );
  const mvp = [...survivors, ...memorial].reduce<SummaryUnit | null>(
    (best, unit) => (unit.kills > (best?.kills ?? 0) ? unit : best),
    null,
  );
  return Object.freeze({
    won,
    stage: run.stage,
    stagesCleared: won ? run.stage : run.stage - 1,
    bossesDefeated: chronicle.bossesDefeated,
    playMs: chronicle.playMs,
    kills: Object.values(chronicle.kills).reduce((sum, count) => sum + count, 0),
    mvp: mvp && Object.freeze({ id: mvp.id, name: mvp.name, classId: mvp.classId, level: mvp.level, kills: mvp.kills }),
    survivors: Object.freeze(survivors),
    memorial: Object.freeze(memorial),
    relics: Object.freeze([...run.relics]),
  });
}

// A play time as the recap shows it: minutes and seconds ("7:05"), with
// hours once it runs past one ("1:02:09").
export function formatPlayTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
