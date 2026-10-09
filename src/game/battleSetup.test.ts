import { describe, expect, it } from 'vitest';
import {
  createBattleLevel,
  DEFAULT_CONTENT,
  regionPreview,
  describeBattle,
  FIRST_STORY_CHAPTER,
  firstWarbandStage,
  getNextBattle,
  STORY_CHAPTERS,
  type GameContent,
  type StoryChapter,
} from './battleSetup.ts';
import { REGION_CONFIGS, REGION_SETTINGS } from '../data/regions.ts';
import { getStageRegion } from './warband/regions.ts';
import { createStageLevel } from './warband/stageLevel.ts';
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
  regions: Object.freeze({
    stagesPerRegion: 2,
    regions: [
      { ...REGION_CONFIGS[0], name: 'Custom Depths' },
      { ...REGION_CONFIGS[1], name: 'Custom Bottom' },
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

  it('moves Warband Mode on a stage, on a map from the new seed', () => {
    expect(getNextBattle({ mode: 'warband', seed: 5, stage: 1 }, 99)).toEqual({ mode: 'warband', seed: 99, stage: 2 });
    expect(getNextBattle({ mode: 'warband', seed: 5, stage: 40 }, 7)).toEqual({ mode: 'warband', seed: 7, stage: 41 });
  });

  it('never moves on from training', () => {
    expect(getNextBattle({ mode: 'training', unitClass: 'soldier' }, 0)).toBeNull();
  });
});

describe('createBattleLevel', () => {
  it('builds the story chapter, training bout or Warband stage the setup names', () => {
    expect(terrainToRows(createBattleLevel(FIRST_STORY_CHAPTER).grid)).toEqual(terrainToRows(createDemoLevel().grid));
    expect(createBattleLevel({ mode: 'training', unitClass: 'soldier' }).deploymentZone).toEqual([]);
    const stage2 = createBattleLevel({ mode: 'warband', seed: 3, stage: 2 });
    expect(terrainToRows(stage2.grid)).toEqual(
      terrainToRows(createStageLevel(3, getStageRegion(2, REGION_SETTINGS)).grid),
    );
  });

  it('gives each level its dialog file from the files passed in', () => {
    expect(createBattleLevel(FIRST_STORY_CHAPTER, CUSTOM_CONTENT).dialogs).toBe(CUSTOM_CONTENT.dialogs.demo);
    const training = createBattleLevel({ mode: 'training', unitClass: 'soldier' }, CUSTOM_CONTENT);
    expect(training.dialogs.opening.map((line) => line.text)).toEqual(['Custom training.']);
    expect(training.dialogs.opening[0].unitClass).toBe('soldier');
  });

  it('builds Warband stages from the regions passed in', () => {
    const stage3 = createBattleLevel({ mode: 'warband', seed: 3, stage: 3 }, CUSTOM_CONTENT);
    const expected = createStageLevel(3, CUSTOM_CONTENT.regions.regions[1]);
    expect(terrainToRows(stage3.grid)).toEqual(terrainToRows(expected.grid));
  });

  it('rejects a story chapter that does not exist', () => {
    expect(() => createBattleLevel({ mode: 'story', chapter: 0 })).toThrow();
    expect(() => createBattleLevel({ mode: 'story', chapter: STORY_CHAPTERS.length + 1 })).toThrow();
    expect(() => createBattleLevel({ mode: 'story', chapter: 1.5 })).toThrow();
  });
});

describe('describeBattle', () => {
  it('names chapters, stages and training', () => {
    expect(describeBattle({ mode: 'story', chapter: 2 }, undefined, CHAPTERS)).toBe('Chapter 2: Two');
    expect(describeBattle({ mode: 'warband', seed: 0, stage: 2 }, CUSTOM_CONTENT)).toBe('Stage 2: Custom Depths');
    expect(describeBattle({ mode: 'warband', seed: 0, stage: 2 })).toBe(`Stage 2: ${REGION_CONFIGS[1].name}`);
    expect(describeBattle({ mode: 'training', unitClass: 'soldier' })).toBe('Training');
  });
});

describe('first battles', () => {
  it('start story mode on chapter 1 and Warband Mode on stage 1', () => {
    expect(FIRST_STORY_CHAPTER).toEqual({ mode: 'story', chapter: 1 });
    expect(firstWarbandStage(42)).toEqual({ mode: 'warband', seed: 42, stage: 1 });
  });
});

describe('regionPreview', () => {
  const settings = { stagesPerRegion: 2, regions: REGION_CONFIGS.slice(0, 3) };

  it("runs a region's first stage on the seed", () => {
    expect(regionPreview(0, 9, settings)).toEqual({ mode: 'warband', seed: 9, stage: 1 });
    expect(regionPreview(2, 9, settings)).toEqual({ mode: 'warband', seed: 9, stage: 5 });
  });

  it('builds the same map as the region itself on that seed', () => {
    const setup = regionPreview(1, 31, settings)!;
    const level = createBattleLevel(setup, { ...DEFAULT_CONTENT, regions: settings });
    expect(terrainToRows(level.grid)).toEqual(terrainToRows(createStageLevel(31, settings.regions[1]).grid));
  });

  it('is null for a region that does not exist', () => {
    expect(regionPreview(3, 9, settings)).toBeNull();
    expect(regionPreview(-1, 9, settings)).toBeNull();
    expect(regionPreview(0.5, 9, settings)).toBeNull();
  });
});
