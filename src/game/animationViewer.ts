// Pure rules for the animation viewer (#/animations, src/ui/AnimationViewer.tsx):
// which unit art it offers, where a frame sits on its sheet and on the
// viewer's stage, and how playback steps from frame to frame. No React, no
// DOM, no hidden state.

import type { Facing } from './facing.ts';
import { getAllUnitSheets, getUnitSprite, TILE_SIZE, UNIT_SHEET, type UnitSheet } from './tileset.ts';
import { UNIT_CLASSES } from './unitClasses.ts';

// One art the viewer offers: its art name (UNIT_SPRITES) and a label naming
// the classes that wear it.
export interface ViewerArt {
  art: string;
  label: string;
}

// Every unit art a class wears, once each, in class order, labelled
// "<Class> (<art>)"; the arts with the most animations come first, so the
// viewer opens on the richest one.
export function getViewerArts(): ViewerArt[] {
  const arts = new Map<string, string[]>();
  for (const { id, label } of UNIT_CLASSES) {
    const art = getUnitSprite(id);
    arts.set(art, [...(arts.get(art) ?? []), label]);
  }
  const entries = [...arts].map(([art, labels]) => ({ art, label: `${labels.join(', ')} (${art})` }));
  const count = (art: string) => getAllUnitSheets(art).length;
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => count(b.entry.art) - count(a.entry.art) || a.index - b.index)
    .map(({ entry }) => entry);
}

// A rectangle in pixels.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where frame `frame` of `sheet` facing `facing` sits on the sheet image.
export function getFrameRect(sheet: UnitSheet, facing: Facing, frame: number): Rect {
  return {
    x: frame * sheet.frameWidth,
    y: UNIT_SHEET.rows[facing] * sheet.frameHeight,
    width: sheet.frameWidth,
    height: sheet.frameHeight,
  };
}

// The stage the viewer draws an art on, in sheet pixels around its tile
// (the tile at 0,0 to TILE_SIZE): big enough for every sheet's frame
// placed by its tile, rounded out to whole tiles so the stage's tile grid
// lines up with the unit's tile.
export function getStageRect(sheets: readonly UnitSheet[]): Rect {
  const roundUp = (px: number) => Math.ceil(px / TILE_SIZE) * TILE_SIZE;
  const left = roundUp(Math.max(0, ...sheets.map((s) => s.tileX)));
  const top = roundUp(Math.max(0, ...sheets.map((s) => s.tileY)));
  const right = roundUp(Math.max(0, ...sheets.map((s) => s.frameWidth - s.tileX - TILE_SIZE)));
  const bottom = roundUp(Math.max(0, ...sheets.map((s) => s.frameHeight - s.tileY - TILE_SIZE)));
  return { x: 0 - left, y: 0 - top, width: left + TILE_SIZE + right, height: top + TILE_SIZE + bottom };
}

// How long a one-shot animation (attack, hit, die) holds its last frame
// before the viewer plays it again.
export const ONE_SHOT_HOLD_MS = 700;

// Where playback is: the frame showing and how long it has shown.
export interface Playback {
  frame: number;
  elapsedMs: number;
}

// Playback `elapsedMs` later at `speed` (1 is the game's pace): a looping
// sheet wraps around; a one-shot holds its last frame for ONE_SHOT_HOLD_MS,
// then starts over.
export function advancePlayback(playback: Playback, sheet: UnitSheet, elapsedMs: number, speed = 1): Playback {
  let { frame, elapsedMs: shown } = playback;
  shown += elapsedMs * speed;
  for (;;) {
    const last = frame >= sheet.frames - 1;
    const hold = last && !sheet.loop ? Math.max(sheet.frameMs, ONE_SHOT_HOLD_MS) : sheet.frameMs;
    if (shown < hold) break;
    shown -= hold;
    frame = last ? 0 : frame + 1;
  }
  return { frame, elapsedMs: shown };
}

// The frame `step` frames from `frame` (stepping by hand), wrapping both ways.
export function stepFrame(sheet: UnitSheet, frame: number, step: number): number {
  return (((frame + step) % sheet.frames) + sheet.frames) % sheet.frames;
}
