import { describe, expect, it } from 'vitest';
import {
  createBattleLevel,
  describeBattle,
  FIRST_STORY_CHAPTER,
  firstDungeonFloor,
  getNextBattle,
  STORY_CHAPTERS,
  type StoryChapter,
} from './battleSetup.ts';
import { DUNGEON_CONFIGS, getDungeonConfig } from './dungeonConfigs.ts';
import { createDungeonLevel } from './dungeonLevel.ts';
import { createDemoLevel } from './demoLevel.ts';
import { terrainToRows } from './mapGen.ts';

const CHAPTERS: readonly StoryChapter[] = [
  { name: 'One', createLevel: createDemoLevel },
  { name: 'Two', createLevel: createDemoLevel },
];

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
    expect(terrainToRows(floor2.grid)).toEqual(terrainToRows(createDungeonLevel(3, getDungeonConfig(2)).grid));
  });

  it('rejects a story chapter that does not exist', () => {
    expect(() => createBattleLevel({ mode: 'story', chapter: 0 })).toThrow();
    expect(() => createBattleLevel({ mode: 'story', chapter: STORY_CHAPTERS.length + 1 })).toThrow();
    expect(() => createBattleLevel({ mode: 'story', chapter: 1.5 })).toThrow();
  });
});

describe('describeBattle', () => {
  it('names chapters, floors and training', () => {
    expect(describeBattle({ mode: 'story', chapter: 2 }, CHAPTERS)).toBe('Chapter 2: Two');
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
