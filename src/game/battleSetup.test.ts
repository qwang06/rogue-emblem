import { describe, expect, it } from 'vitest';
import {
  createBattleLevel,
  DEFAULT_CONTENT,
  regionPreview,
  describeBattle,
  FIRST_STORY_CHAPTER,
  getNextBattle,
  runStage,
  STORY_CHAPTERS,
  type GameContent,
  type StoryChapter,
} from './battleSetup.ts';
import { REGION_CONFIGS, REGION_SETTINGS } from '../data/regions.ts';
import { getStageRegion } from './warband/regions.ts';
import { advanceStage, applyBattleResult, createRun, getStageSeed, restoreRoster } from './warband/run.ts';
import { createStageLevel, createStartingWarband, WARBAND_MAX_DEPLOYED } from './warband/stageLevel.ts';
import { Archer } from './Archer.ts';
import { createDemoLevel, PLAYER_ROSTER } from './demoLevel.ts';
import { parseCharacters, parseDialogScript } from './dialogScript.ts';
import { terrainToRows } from './mapGen.ts';
import { Villager } from './Villager.ts';

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

  it('gives one enemy loot in each of the first three Warband stages and none after', () => {
    const carriers = (stage: number) =>
      [...createBattleLevel({ mode: 'warband', seed: 5, stage }).units.values()].filter((unit) => unit.loot).length;
    expect([1, 2, 3, 4].map(carriers)).toEqual([1, 1, 1, 0]);
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
  it('start story mode on chapter 1', () => {
    expect(FIRST_STORY_CHAPTER).toEqual({ mode: 'story', chapter: 1 });
  });
});

describe('runStage', () => {
  // A run that has grown past its starting unit: the demo roster's three villagers.
  const run = createRun(
    42,
    new Map(Object.entries(PLAYER_ROSTER).map(([id, name]) => [id, new Villager({ name, team: 'player' })])),
  );

  it("fights the run's current stage on its stage seed", () => {
    expect(runStage(run)).toEqual({ mode: 'warband', seed: getStageSeed(42, 1), stage: 1, run });
    expect(runStage(advanceStage(run))).toMatchObject({ seed: getStageSeed(42, 2), stage: 2 });
  });

  it("fields the run's roster as it stands, with the run's deploy cap", () => {
    const units = restoreRoster(run);
    units.get('villager-1')!.takeDamage(3);
    units.get('villager-2')!.takeDamage(99);
    const after = { ...advanceStage(applyBattleResult(run, { units })), deployCap: 2 };

    const level = createBattleLevel(runStage(after));
    expect(level.roster).toEqual(['villager-1', 'villager-3']);
    expect(level.maxDeployed).toBe(2);
    const alden = level.units.get('villager-1')!;
    expect(alden.health).toBe(alden.maxHealth - 3);
    expect(level.units.has('villager-2')).toBe(false);
  });

  it('builds the same map each time for the same run and stage', () => {
    expect(terrainToRows(createBattleLevel(runStage(run)).grid)).toEqual(
      terrainToRows(createBattleLevel(runStage(run)).grid),
    );
  });

  it('has no next battle of its own', () => {
    expect(() => getNextBattle(runStage(run), 0)).toThrow(/finishStage/);
  });
});

describe('createStageLevel rosters', () => {
  it('fields the starting warband without a roster', () => {
    const level = createStageLevel(3, REGION_CONFIGS[0]);
    expect(level.roster).toEqual([...createStartingWarband().keys()]);
    expect(level.maxDeployed).toBe(WARBAND_MAX_DEPLOYED);
  });

  it('fields the roster it is given', () => {
    const archer = new Archer({ name: 'Bryn', team: 'player' });
    const level = createStageLevel(3, REGION_CONFIGS[0], new Map([['bryn', archer]]), 1);
    expect(level.roster).toEqual(['bryn']);
    expect(level.units.get('bryn')).toBe(archer);
    expect(level.maxDeployed).toBe(1);
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
