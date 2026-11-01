// Which battle the map runs, and what comes after it. The title screen picks
// a BattleSetup, the map scene builds its level with createBattleLevel, and
// once the objective is completed getNextBattle says where to go next: the
// next story chapter, the next Warband Mode stage, or nowhere (back to the
// title).

import { DIALOGS } from '../data/dialogs.ts';
import type { DialogFiles } from './dialogScript.ts';
import { REGION_SETTINGS } from '../data/regions.ts';
import { getRegionStages, getStageRegion, type RegionSettings } from './warband/regions.ts';
import { getBattleSeed, getStageSeed, restoreRoster, restoreUnit, type RunState } from './warband/run.ts';
import { GUEST_UNIT_ID, rollGuest } from './warband/recruitment.ts';
import { setUnit } from './grid.ts';
import { getMoveCost } from './movement.ts';
import { createStageLevel, pickStageArchetype, withArchetype } from './warband/stageLevel.ts';
import { pickStageObjective, placeObjective } from './warband/stageObjective.ts';
import { getStageLootCount } from './loot.ts';
import { applyEliteAffixes, rollEliteAffixes } from './warband/elites.ts';
import { getRunSite, getSiteRegion, shiftEnemyLevels } from './warband/travel.ts';
import { getRunHeatRules } from './warband/heat.ts';
import type { RegionConfig } from './warband/regions.ts';
import { createDemoLevel, type DemoLevel } from './demoLevel.ts';
import { createTrainingLevel, type Level } from './trainingLevel.ts';
import { createSeededRng, randomInt } from './rng.ts';

export type BattleSetup =
  | { mode: 'story'; chapter: number }
  | { mode: 'training'; unitClass: string }
  | { mode: 'warband'; seed: number; stage: number; run?: RunState };

// A battle's starting state, whichever mode built it.
export type BattleLevel = Level & Partial<DemoLevel>;

// The authored data battles are built from: the built-in files unless the
// player uploaded their own in the config editor (see src/data/customContent.ts).
export interface GameContent {
  // Every level's conversations, by dialog file name.
  dialogs: DialogFiles;
  // Warband Mode's regions.
  regions: RegionSettings;
}

export const DEFAULT_CONTENT: GameContent = Object.freeze({ dialogs: DIALOGS, regions: REGION_SETTINGS });

// A story chapter builds its level from the game content, picking out its
// own dialog file.
export interface StoryChapter {
  name: string;
  createLevel: (content: GameContent) => BattleLevel;
}

// Story Mode's chapters in order (chapter 1 first).
export const STORY_CHAPTERS: readonly StoryChapter[] = Object.freeze([
  Object.freeze({ name: 'The Old Gate', createLevel: (content: GameContent) => createDemoLevel(content.dialogs.demo) }),
]);

// The first battle of each mode that has one.
export const FIRST_STORY_CHAPTER: BattleSetup = Object.freeze({ mode: 'story', chapter: 1 });

// The battle for a run's current stage: its stage, on the map
// getStageSeed gives it, fought by the run's roster.
export function runStage(run: RunState): BattleSetup {
  return { mode: 'warband', seed: getStageSeed(run.seed, run.stage), stage: run.stage, run };
}

// The seed a battle's dice roll from when it's fixed: a stage of a run
// rolls from the run's seed (getBattleSeed), so the run replays from it.
// Null for any other battle, which rolls fresh each time.
export function getBattleDiceSeed(setup: BattleSetup): number | null {
  return setup.mode === 'warband' && setup.run ? getBattleSeed(setup.run.seed, setup.stage) : null;
}

function getStoryChapter(chapter: number, chapters: readonly StoryChapter[]): StoryChapter {
  const found = Number.isInteger(chapter) ? chapters[chapter - 1] : undefined;
  if (!found) throw new Error(`No story chapter ${chapter}`);
  return found;
}

// Builds the level a setup describes from `content` (its dialog, and a
// Warband Mode stage's region). A stage of a run fields the run's roster
// and deploy cap; one without a run (a region preview) the starting
// warband. Either way the stage's enemies carry its loot (getStageLootCount),
// it plays the objective pickStageObjective gives it, and its map is laid
// out as the archetype pickStageArchetype picks.
export function createBattleLevel(
  setup: BattleSetup,
  content: GameContent = DEFAULT_CONTENT,
  chapters: readonly StoryChapter[] = STORY_CHAPTERS,
): BattleLevel {
  switch (setup.mode) {
    case 'story':
      return getStoryChapter(setup.chapter, chapters).createLevel(content);
    case 'training':
      return createTrainingLevel(setup.unitClass, content.dialogs.training);
    case 'warband': {
      const unheated =
        (setup.run && getSiteRegion(setup.run, content.regions)) ?? getStageRegion(setup.stage, content.regions);
      // The run's Heat raises every enemy's level (see heat.ts).
      const baseRegion = setup.run ? shiftEnemyLevels(unheated, getRunHeatRules(setup.run).enemyLevels) : unheated;
      if (setup.run && isVisit(setup.run)) return createVisitLevel(setup, setup.run, baseRegion);
      const spec = pickStageObjective(setup.stage, baseRegion, setup.seed);
      const region = withArchetype(baseRegion, pickStageArchetype(baseRegion));
      const lootCount = getStageLootCount(setup.stage);
      let level = setup.run
        ? createStageLevel(setup.seed, region, restoreRoster(setup.run), setup.run.deployCap, lootCount)
        : createStageLevel(setup.seed, region, undefined, undefined, lootCount);
      const guest = setup.run && rollGuest(setup.run);
      if (guest) {
        const zone = new Set(level.deploymentZone.map(({ x, y }) => `${x},${y}`));
        const front = Math.max(...level.deploymentZone.map(({ y }) => y));
        const tile = level.grid.cells
          .filter((cell) => !cell.unitId && !zone.has(`${cell.x},${cell.y}`) && getMoveCost(cell.terrain) < Infinity)
          .sort((a, b) => {
            const distance = (cell: typeof a) =>
              Math.min(...level.deploymentZone.map(({ x, y }) => Math.abs(cell.x - x) + Math.abs(cell.y - y)));
            return distance(a) - distance(b) || Math.abs(front - a.y) - Math.abs(front - b.y) || a.x - b.x;
          })[0];
        if (tile) {
          const unit = restoreUnit(guest);
          unit.name = `${guest.name} (Guest)`;
          unit.team = 'guest';
          level = {
            ...level,
            grid: setUnit(level.grid, tile.x, tile.y, GUEST_UNIT_ID),
            units: new Map([...level.units, [GUEST_UNIT_ID, unit]]),
          };
        }
      }
      const objective = placeObjective(spec, level);
      if (setup.run && getRunSite(setup.run)?.kind === 'elite') {
        const bossUnitId = objective.kind === 'boss' ? objective.unitId : undefined;
        applyEliteAffixes(level.units, rollEliteAffixes(setup.run.seed, setup.stage), bossUnitId);
      }
      return { ...level, objective };
    }
  }
}

// Whether `run` is visiting a realm site with no battle: a town or a shrine.
function isVisit(run: RunState): boolean {
  const kind = getRunSite(run)?.kind;
  return kind === 'town' || kind === 'shrine';
}

// The map shown while the warband visits a town or shrine: the site's
// region with no enemies (a town grows a few more buildings), and the
// roster off the map. The scene opens the camp or the blessing over it.
function createVisitLevel(setup: { seed: number }, run: RunState, region: RegionConfig): BattleLevel {
  const town = getRunSite(run)?.kind === 'town';
  const peaceful: RegionConfig = {
    ...region,
    objective: undefined,
    enemies: [],
    terrain: { ...region.terrain, buildings: town ? 4 : 1 },
  };
  const level = createStageLevel(setup.seed, peaceful, restoreRoster(run), run.deployCap, 0);
  return { ...level, objective: placeObjective({ kind: 'rout' }, level) };
}

// The battle after `setup` is won, or null when there's none and the
// player goes back to the title: story mode moves to the next chapter
// until the last; Warband Mode moves on a stage, on a new map made from
// `seed`, and never ends; training is a single bout. A stage of a run
// isn't moved on here, since its next stage depends on how the battle went
// (see finishStage in warband/run.ts).
export function getNextBattle(
  setup: BattleSetup,
  seed: number,
  chapters: readonly StoryChapter[] = STORY_CHAPTERS,
): BattleSetup | null {
  switch (setup.mode) {
    case 'story':
      return setup.chapter < chapters.length ? { mode: 'story', chapter: setup.chapter + 1 } : null;
    case 'training':
      return null;
    case 'warband':
      if (setup.run) throw new Error("A run's next stage comes from finishStage");
      return { mode: 'warband', seed, stage: setup.stage + 1 };
  }
}

// A short title for a battle, e.g. "Chapter 1: The Old Gate" or
// "Stage 2: Lakeside".
export function describeBattle(
  setup: BattleSetup,
  content: GameContent = DEFAULT_CONTENT,
  chapters: readonly StoryChapter[] = STORY_CHAPTERS,
): string {
  switch (setup.mode) {
    case 'story':
      return `Chapter ${setup.chapter}: ${getStoryChapter(setup.chapter, chapters).name}`;
    case 'training':
      return 'Training';
    case 'warband': {
      const at = setup.run && getRunSite(setup.run);
      if (at) return at.kind === 'town' || at.kind === 'shrine' ? at.name : `Stage ${setup.stage}: ${at.name}`;
      return `Stage ${setup.stage}: ${getStageRegion(setup.stage, content.regions).name}`;
    }
  }
}

// The battle that shows region `index` of `settings` as it plays: its
// first stage, on a map made from `seed` (so the same map the region makes
// with createStageLevel). Null when there's no such region.
export function regionPreview(index: number, seed: number, settings: RegionSettings): BattleSetup | null {
  if (!Number.isInteger(index) || index < 0 || index >= settings.regions.length) return null;
  const { first } = getRegionStages(index, settings.regions.length, settings.stagesPerRegion);
  return { mode: 'warband', seed, stage: first };
}

// The battle the Map Generator shows for `seed`: region `region` of
// `settings` previewed as regionPreview does, or with no region one picked
// from the seed, so one seed is always the same map and a new seed may land
// in any region. Null for a region that doesn't exist.
export function generatedMap(seed: number, settings: RegionSettings, region: number | null = null): BattleSetup | null {
  const index = region ?? randomInt(createSeededRng(seed), 0, settings.regions.length - 1);
  return regionPreview(index, seed, settings);
}
