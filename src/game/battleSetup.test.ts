import { describe, expect, it } from 'vitest';
import {
  createBattleLevel,
  DEFAULT_CONTENT,
  dungeonConfigPreview,
  describeBattle,
  FIRST_STORY_CHAPTER,
  firstDungeonFloor,
  getNextBattle,
  STORY_CHAPTERS,
  type GameContent,
  type StoryChapter,
} from './battleSetup.ts';
import { DUNGEON_CONFIGS, DUNGEON_SETTINGS } from '../data/dungeon.ts';
import { getDungeonFloor } from './dungeonConfigs.ts';
import { createDungeonLevel } from './dungeonLevel.ts';
import { createDemoLevel } from './demoLevel.ts';
import { parseCharacters, parseDialogScript } from './dialogScript.ts';
import { terrainToRows } from './mapGen.ts';

const CHAPTERS: readonly StoryChapter[] = [
  { name: 'One', createLevel: () => createDemoLevel() },
  { name: 'Two', createLevel: () => createDemoLevel() },
];

const characters = parseCharacters({ hero: { name: 'Hero', team: 'player' } });
const CUSTOM_CONTENT: GameContent = Object.freeze({
  dialogs: Object.freeze({
    demo: parseDialogScript('[opening]\nhero: Custom demo.', characters),
    training: parseDialogScript('[opening]\nhero: Custom training.', characters),
  }),
  dungeon: Object.freeze({
    floorsPerConfig: 2,
    floors: [
      { ...DUNGEON_CONFIGS[0], name: 'Custom Depths' },
      { ...DUNGEON_CONFIGS[1], name: 'Custom Bottom' },
    ],
  }),
});

describe('getNextBattle', () => {
  it('moves story mode on to the next chapter', () => {
    expect(getNextBattle({ mode: 'story', chapter: 1 }, 0, CHAPTERS)).toEqual({ mode: 'story', chapter: 2 });
  });

  it('ends story mode after the last chapter', () => {
    expect(getNextBattle({ mode: 'story', chapter: 2 }, 0, CHAPTERS)).toBeNull();
    expect(getNextBattle({ mode: 'story', chapter: STORY_CHAPTERS.length }, 0)).toBeNull();
  });

  it('takes a dungeon one floor down, on a map from the new seed', () => {
    expect(getNextBattle({ mode: 'dungeon', seed: 5, floor: 1 }, 99)).toEqual({ mode: 'dungeon', seed: 99, floor: 2 });
    expect(getNextBattle({ mode: 'dungeon', seed: 5, floor: 40 }, 7)).toEqual({ mode: 'dungeon', seed: 7, floor: 41 });
  });

  it('never moves on from training', () => {
    expect(getNextBattle({ mode: 'training', unitClass: 'soldier' }, 0)).toBeNull();
  });
});

describe('createBattleLevel', () => {
  it('builds the story chapter, training bout or dungeon floor the setup names', () => {
    expect(terrainToRows(createBattleLevel(FIRST_STORY_CHAPTER).grid)).toEqual(terrainToRows(createDemoLevel().grid));
    expect(createBattleLevel({ mode: 'training', unitClass: 'soldier' }).deploymentZone).toEqual([]);
    const floor2 = createBattleLevel({ mode: 'dungeon', seed: 3, floor: 2 });
    expect(terrainToRows(floor2.grid)).toEqual(
      terrainToRows(createDungeonLevel(3, getDungeonFloor(2, DUNGEON_SETTINGS)).grid),
    );
  });

  it('gives each level its dialog file from the files passed in', () => {
    expect(createBattleLevel(FIRST_STORY_CHAPTER, CUSTOM_CONTENT).dialogs).toBe(CUSTOM_CONTENT.dialogs.demo);
    const training = createBattleLevel({ mode: 'training', unitClass: 'soldier' }, CUSTOM_CONTENT);
    expect(training.dialogs.opening.map((line) => line.text)).toEqual(['Custom training.']);
    expect(training.dialogs.opening[0].unitClass).toBe('soldier');
  });

  it('builds dungeon floors from the dungeon settings passed in', () => {
    const floor3 = createBattleLevel({ mode: 'dungeon', seed: 3, floor: 3 }, CUSTOM_CONTENT);
    const expected = createDungeonLevel(3, CUSTOM_CONTENT.dungeon.floors[1]);
    expect(terrainToRows(floor3.grid)).toEqual(terrainToRows(expected.grid));
  });

  it('rejects a story chapter that does not exist', () => {
    expect(() => createBattleLevel({ mode: 'story', chapter: 0 })).toThrow();
    expect(() => createBattleLevel({ mode: 'story', chapter: STORY_CHAPTERS.length + 1 })).toThrow();
    expect(() => createBattleLevel({ mode: 'story', chapter: 1.5 })).toThrow();
  });
});

describe('describeBattle', () => {
  it('names chapters, floors and training', () => {
    expect(describeBattle({ mode: 'story', chapter: 2 }, undefined, CHAPTERS)).toBe('Chapter 2: Two');
    expect(describeBattle({ mode: 'dungeon', seed: 0, floor: 2 }, CUSTOM_CONTENT)).toBe('Floor 2: Custom Depths');
    expect(describeBattle({ mode: 'dungeon', seed: 0, floor: 2 })).toBe(`Floor 2: ${DUNGEON_CONFIGS[1].name}`);
    expect(describeBattle({ mode: 'training', unitClass: 'soldier' })).toBe('Training');
  });
});

describe('first battles', () => {
  it('start story mode on chapter 1 and a dungeon on floor 1', () => {
    expect(FIRST_STORY_CHAPTER).toEqual({ mode: 'story', chapter: 1 });
    expect(firstDungeonFloor(42)).toEqual({ mode: 'dungeon', seed: 42, floor: 1 });
  });
});

describe('dungeonConfigPreview', () => {
  const settings = { floorsPerConfig: 2, floors: DUNGEON_CONFIGS.slice(0, 3) };

  it("runs a config's first floor on the seed", () => {
    expect(dungeonConfigPreview(0, 9, settings)).toEqual({ mode: 'dungeon', seed: 9, floor: 1 });
    expect(dungeonConfigPreview(2, 9, settings)).toEqual({ mode: 'dungeon', seed: 9, floor: 5 });
  });

  it('builds the same map as the config itself on that seed', () => {
    const setup = dungeonConfigPreview(1, 31, settings)!;
    const level = createBattleLevel(setup, { ...DEFAULT_CONTENT, dungeon: settings });
    expect(terrainToRows(level.grid)).toEqual(terrainToRows(createDungeonLevel(31, settings.floors[1]).grid));
  });

  it('is null for a config that does not exist', () => {
    expect(dungeonConfigPreview(3, 9, settings)).toBeNull();
    expect(dungeonConfigPreview(-1, 9, settings)).toBeNull();
    expect(dungeonConfigPreview(0.5, 9, settings)).toBeNull();
  });
});
