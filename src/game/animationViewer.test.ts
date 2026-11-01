import { describe, expect, it } from 'vitest';
import {
  advancePlayback,
  getFrameRect,
  getStageRect,
  getViewerArts,
  ONE_SHOT_HOLD_MS,
  stepFrame,
} from './animationViewer.ts';
import { getAllUnitArts, getAllUnitSheets, getUnitSheet, TILE_SIZE } from './tileset.ts';

const idle = getUnitSheet('Soldier_03', 'idle')!;
const attack = getUnitSheet('Red_Dragon', 'attack')!;

describe('getViewerArts', () => {
  it("offers every art once, every faction's version included, the monsters' first", () => {
    const arts = getViewerArts();
    expect(arts[0]).toEqual({ art: 'Slime', label: 'Slime (Slime)' });
    expect(arts.find(({ art }) => art === 'Archer_03')?.label).toBe('Archer, Rose Court (Archer_03)');
    expect(new Set(arts.map(({ art }) => art))).toEqual(new Set(getAllUnitArts()));
    expect(arts).toHaveLength(new Set(arts.map(({ art }) => art)).size);
  });
});

describe('getFrameRect', () => {
  it("picks the facing's row and the frame's column", () => {
    expect(getFrameRect(idle, 'down', 0)).toEqual({ x: 0, y: 0, width: 32, height: 32 });
    expect(getFrameRect(idle, 'up', 3)).toEqual({ x: 96, y: 96, width: 32, height: 32 });
    expect(getFrameRect(attack, 'right', 5)).toEqual({ x: 560, y: 192, width: 112, height: 96 });
  });
});

describe('getStageRect', () => {
  it("is the unit's tile alone for one-tile sheets", () => {
    expect(getStageRect([idle])).toEqual({ x: 0, y: 0, width: TILE_SIZE, height: TILE_SIZE });
  });

  it("reaches out in whole tiles to fit the dragon's breath", () => {
    expect(getStageRect(getAllUnitSheets('Red_Dragon'))).toEqual({ x: -64, y: -32, width: 160, height: 96 });
  });
});

describe('advancePlayback', () => {
  it('steps a looping sheet a frame per frameMs, wrapping around', () => {
    expect(advancePlayback({ frame: 0, elapsedMs: 0 }, idle, idle.frameMs - 1)).toEqual({
      frame: 0,
      elapsedMs: idle.frameMs - 1,
    });
    expect(advancePlayback({ frame: 0, elapsedMs: 0 }, idle, idle.frameMs)).toEqual({ frame: 1, elapsedMs: 0 });
    expect(advancePlayback({ frame: 3, elapsedMs: 0 }, idle, idle.frameMs + 5)).toEqual({ frame: 0, elapsedMs: 5 });
  });

  it('plays faster or slower with speed', () => {
    expect(advancePlayback({ frame: 0, elapsedMs: 0 }, idle, idle.frameMs / 2, 2).frame).toBe(1);
    expect(advancePlayback({ frame: 0, elapsedMs: 0 }, idle, idle.frameMs, 0.5).frame).toBe(0);
  });

  it("holds a one-shot's last frame before starting over", () => {
    const last = { frame: attack.frames - 1, elapsedMs: 0 };
    expect(advancePlayback(last, attack, ONE_SHOT_HOLD_MS - 1).frame).toBe(attack.frames - 1);
    expect(advancePlayback(last, attack, ONE_SHOT_HOLD_MS).frame).toBe(0);
  });
});

describe('stepFrame', () => {
  it('wraps both ways', () => {
    expect(stepFrame(attack, 0, -1)).toBe(5);
    expect(stepFrame(attack, 5, 1)).toBe(0);
    expect(stepFrame(attack, 2, 1)).toBe(3);
  });
});
