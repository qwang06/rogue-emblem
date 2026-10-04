// Which battle the map runs, and what comes after it. The title screen picks
// a BattleSetup, the map scene builds its level with createBattleLevel, and
// once the objective is completed getNextBattle says where to go next: the
// next story chapter, the next dungeon floor, or nowhere (back to the title).

import { DIALOGS } from '../data/dialogs.ts';
import type { DialogFiles } from './dialogScript.ts';
import { DUNGEON_SETTINGS } from '../data/dungeon.ts';
import { getDungeonFloor, type DungeonSettings } from './dungeonConfigs.ts';
import { createDungeonLevel } from './dungeonLevel.ts';
import { createDemoLevel, type DemoLevel } from './demoLevel.ts';
import { createTrainingLevel, type Level } from './trainingLevel.ts';

export type BattleSetup =
  | { mode: 'story'; chapter: number }
  | { mode: 'training'; unitClass: string }
  | { mode: 'dungeon'; seed: number; floor: number };

// A battle's starting state, whichever mode built it.
export type BattleLevel = Level & Partial<DemoLevel>;

// The authored data battles are built from: the built-in files unless the
// player uploaded their own in the config editor (see src/data/customContent.ts).
export interface GameContent {
  // Every level's conversations, by dialog file name.
  dialogs: DialogFiles;
  // Dungeon Mode's floor configs.
  dungeon: DungeonSettings;
}

export const DEFAULT_CONTENT: GameContent = Object.freeze({ dialogs: DIALOGS, dungeon: DUNGEON_SETTINGS });

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

export function firstDungeonFloor(seed: number): BattleSetup {
  return { mode: 'dungeon', seed, floor: 1 };
}

function getStoryChapter(chapter: number, chapters: readonly StoryChapter[]): StoryChapter {
  const found = Number.isInteger(chapter) ? chapters[chapter - 1] : undefined;
  if (!found) throw new Error(`No story chapter ${chapter}`);
  return found;
}

// Builds the level a setup describes from `content` (its dialog, and a
// dungeon floor's config).
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
    case 'dungeon':
      return createDungeonLevel(setup.seed, getDungeonFloor(setup.floor, content.dungeon));
  }
}

// The battle after `setup` is won, or null when there's none and the
// player goes back to the title: story mode moves to the next chapter
// until the last; a dungeon goes one floor down, on a new map made from
// `seed`, and never ends; training is a single bout.
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
    case 'dungeon':
      return { mode: 'dungeon', seed, floor: setup.floor + 1 };
  }
}

// A short title for a battle, e.g. "Chapter 1: The Old Gate" or
// "Floor 2: Lakeside".
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
    case 'dungeon':
      return `Floor ${setup.floor}: ${getDungeonFloor(setup.floor, content.dungeon).name}`;
  }
}
