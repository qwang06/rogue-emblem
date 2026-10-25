// Snapshot of a finished Warband Mode run's recap for React: the summary
// (src/game/warband/runSummary.ts) with units named by class and sprite,
// the play time as text, and the renown the run earned (meta.ts). Plain
// frozen data.

import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { findOrigin } from '../game/warband/origins.ts';
import { findRelic } from '../game/warband/relics.ts';
import { getNextUnlock, type MetaState, type RenownLine, type Unlock } from '../game/warband/meta.ts';
import { formatPlayTime, type RunSummary, type SummaryUnit } from '../game/warband/runSummary.ts';

export interface SummaryUnitView {
  key: string;
  name: string;
  classLabel: string;
  level: number;
  kills: number;
  sprite: string;
}

export interface MemorialView extends SummaryUnitView {
  // The stage the unit fell on, or null when the run didn't record it.
  stage: number | null;
}

export interface RenownView {
  lines: readonly RenownLine[];
  // The renown this run earned, and the total after it.
  earned: number;
  total: number;
  // The unlocks this run opened, by label.
  unlocked: readonly string[];
  // The next unlock still to open, or null when all are.
  next: { label: string; renown: number } | null;
}

export interface RunSummaryView {
  won: boolean;
  stage: number;
  stagesCleared: number;
  bossesDefeated: number;
  kills: number;
  playTime: string;
  mvp: SummaryUnitView | null;
  survivors: number;
  memorial: readonly MemorialView[];
  // The relics held, by name.
  relics: readonly string[];
  // The origin it started as, by label (null for a run from before
  // origins), and the Heat it was played at.
  origin: string | null;
  heat: number;
  renown: RenownView;
}

// The recap for `summary`, with the renown `recorded` (recordRun's result)
// gave it. `relicName` names a relic by id (its relics.ts name, or the id
// as words for one that isn't known).
export function toRunSummaryView(
  summary: RunSummary,
  recorded: {
    meta: MetaState;
    earned: { lines: readonly RenownLine[]; total: number };
    unlocked: readonly Unlock[];
    heatUnlocked?: number | null;
  },
  relicName: (id: string) => string = (id) => findRelic(id)?.name ?? humanizeId(id),
): RunSummaryView {
  const next = getNextUnlock(recorded.meta);
  return Object.freeze({
    won: summary.won,
    stage: summary.stage,
    stagesCleared: summary.stagesCleared,
    bossesDefeated: summary.bossesDefeated,
    kills: summary.kills,
    playTime: formatPlayTime(summary.playMs),
    mvp: summary.mvp && toSummaryUnitView(summary.mvp),
    survivors: summary.survivors.length,
    memorial: Object.freeze(
      summary.memorial.map((unit) => Object.freeze({ ...toSummaryUnitView(unit), stage: unit.stage })),
    ),
    relics: Object.freeze(summary.relics.map(relicName)),
    origin: summary.origin && (findOrigin(summary.origin)?.label ?? humanizeId(summary.origin)),
    heat: summary.heat,
    renown: Object.freeze({
      lines: recorded.earned.lines,
      earned: recorded.earned.total,
      total: recorded.meta.renown,
      unlocked: Object.freeze([
        ...recorded.unlocked.map((unlock) => unlock.label),
        ...(recorded.heatUnlocked ? [`Heat ${recorded.heatUnlocked}`] : []),
      ]),
      next: next && Object.freeze({ label: next.label, renown: next.renown }),
    }),
  });
}

function toSummaryUnitView(unit: SummaryUnit): SummaryUnitView {
  return Object.freeze({
    key: unit.id,
    name: unit.name,
    classLabel: UNIT_CLASSES.find((unitClass) => unitClass.id === unit.classId)?.label ?? unit.classId,
    level: unit.level,
    kills: unit.kills,
    sprite: getUnitSprite(unit.classId),
  });
}

// An id as words: "lucky-coin" → "Lucky Coin".
export function humanizeId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
