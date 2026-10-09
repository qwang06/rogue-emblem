// Which battle the map runs, and what comes after it. The title screen picks
// a BattleSetup, the map scene builds its level with createBattleLevel, and
// once the objective is completed getNextBattle says where to go next: the
// next story chapter, the next Warband Mode stage, or nowhere (back to the
// title).

import { DIALOGS } from '../data/dialogs.ts';
import type { DialogFiles } from './dialogScript.ts';
import { REGION_SETTINGS } from '../data/regions.ts';
import { getRegionStages, getStageRegion, type RegionSettings } from './warband/regions.ts';
import { getStageSeed, restoreRoster, type RunState } from './warband/run.ts';
import { createStageLevel } from './warband/stageLevel.ts';
import { createDemoLevel, type DemoLevel } from './demoLevel.ts';
import { createTrainingLevel, type Level } from './trainingLevel.ts';

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

function getStoryChapter(chapter: number, chapters: readonly StoryChapter[]): StoryChapter {
  const found = Number.isInteger(chapter) ? chapters[chapter - 1] : undefined;
  if (!found) throw new Error(`No story chapter ${chapter}`);
  return found;
}

// Builds the level a setup describes from `content` (its dialog, and a
// Warband Mode stage's region). A stage of a run fields the run's roster
// and deploy cap; one without a run (a region preview) the starting
// warband.
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
    case 'warband':
      return setup.run
        ? createStageLevel(
            setup.seed,
            getStageRegion(setup.stage, content.regions),
            restoreRoster(setup.run),
            setup.run.deployCap,
          )
        : createStageLevel(setup.seed, getStageRegion(setup.stage, content.regions));
  }
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
    case 'warband':
      return `Stage ${setup.stage}: ${getStageRegion(setup.stage, content.regions).name}`;
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
