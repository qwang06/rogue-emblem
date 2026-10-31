// Code-driven animation for units drawn from a single image (SINGLE_IMAGE_UNITS
// in tileset.ts) rather than a sheet of frames: the one picture breathes while
// standing, hops while walking, leans into an attack and recoils from a hit by
// moving, squashing and tilting it. Pure functions of time, so the feel can be
// tuned and tested without Phaser; src/scenes/unitRig.ts applies the poses.

import type { Facing } from './facing.ts';

// How a unit's image is drawn this moment, relative to standing still: `x`,
// `y` move its feet (in fractions of a tile, +x toward where it faces, +y
// down), `scaleX` / `scaleY` stretch it about its feet, and `angle` tilts it
// about its feet in degrees (+ leans toward where it faces).
export interface Pose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

// What a unit is doing over time: standing (`idle`) or walking (`move`),
// matching the sheet units' UnitAnimation names.
export type RigMotion = 'idle' | 'move';

// A one-off flourish played over the motion: swinging at a foe, or taking a
// blow.
export type RigAction = 'attack' | 'hit';

// Which way the image faces: 1 as drawn (the art faces right), -1 mirrored.
export type RigSide = 1 | -1;

export const REST_POSE: Readonly<Pose> = Object.freeze({ x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 });

// One breath, in and out.
export const BREATH_MS = 1800;
// How far a breath stretches the unit up (and thins it by half as much).
const BREATH_STRETCH = 0.025;

// One full walk cycle, two strides (left foot, right foot), for every unit
// whatever its number of frames: a sheet's walk shows each of its frames for
// getWalkFrameMs(frames), and a hopping unit hops once per stride. It sets
// the pace of the legs only; how fast a unit crosses tiles is GridScene's
// MOVE_STEP_MS.
export const WALK_CYCLE_MS = 720;

// How long each frame of a walk cycle of `frames` frames shows.
export function getWalkFrameMs(frames: number): number {
  return WALK_CYCLE_MS / Math.max(1, frames);
}

// One hop of a code-drawn walk: one stride.
export const HOP_MS = WALK_CYCLE_MS / 2;
// How high a hop lifts the feet, in tiles.
const HOP_HEIGHT = 0.06;
// The rock from side to side over two hops, in degrees.
const HOP_TILT = 4;
// How much the unit squashes as it lands.
const HOP_SQUASH = 0.06;

// Attack: a short wind-up leaning back, then a lunge leaning in, held through
// the blow (effects.ts moves the sprite itself) and eased back upright.
export const ATTACK_MS = 420;
const ATTACK_WINDUP_MS = 90;
const ATTACK_LEAN_IN_MS = 180;
const ATTACK_WINDUP_ANGLE = -6;
const ATTACK_LEAN_ANGLE = 10;
const ATTACK_STRETCH = 0.08;

// Hit: knocked back, tilting away and squashed, then springing back with a
// small overshoot.
export const HIT_MS = 360;
const HIT_ANGLE = -12;
const HIT_KNOCKBACK = 0.06;
const HIT_SQUASH = 0.1;

// A walk drawn frame by frame instead of hopped in code: a sheet of
// `frames` square frames (read left to right, top to bottom) making one walk
// cycle (WALK_CYCLE_MS). The picture still breathes in code while standing.
export interface WalkFrames {
  key: string;
  frames: number;
}

// The frame of a walk cycle `ms` into the walk, looping.
export function getWalkFrame({ frames }: WalkFrames, ms: number): number {
  return ((Math.floor(ms / getWalkFrameMs(frames)) % frames) + frames) % frames;
}

// The standing or walking pose `ms` into the motion. A unit whose walk is
// drawn frame by frame (`framedWalk`) walks upright: the frames already
// carry the step.
export function getMotionPose(motion: RigMotion, ms: number, framedWalk = false): Pose {
  if (motion === 'move' && framedWalk) return REST_POSE;
  if (motion === 'idle') {
    const breath = Math.sin((2 * Math.PI * ms) / BREATH_MS);
    return { ...REST_POSE, scaleX: 1 - (BREATH_STRETCH / 2) * breath, scaleY: 1 + BREATH_STRETCH * breath };
  }
  const phase = ms / HOP_MS;
  const lift = Math.abs(Math.sin(Math.PI * phase));
  const squash = HOP_SQUASH * (1 - lift) ** 4;
  return {
    x: 0,
    y: -HOP_HEIGHT * lift,
    scaleX: 1 + squash,
    scaleY: 1 - squash,
    angle: HOP_TILT * Math.sin(Math.PI * phase),
  };
}

// How far along an action's curve `ms` is, 0 to 1, with `ms` clamped to it.
function progress(ms: number, start: number, length: number): number {
  return Math.min(1, Math.max(0, (ms - start) / length));
}

const easeOut = (t: number) => 1 - (1 - t) ** 2;

// The action's pose `ms` into it, or null once it's over (or before it
// starts), when the unit is back to its motion alone.
export function getActionPose(action: RigAction, ms: number): Pose | null {
  if (action === 'attack') {
    if (ms < 0 || ms >= ATTACK_MS) return null;
    if (ms < ATTACK_WINDUP_MS) {
      const t = easeOut(progress(ms, 0, ATTACK_WINDUP_MS));
      return { ...REST_POSE, angle: ATTACK_WINDUP_ANGLE * t, scaleY: 1 + (ATTACK_STRETCH / 2) * t };
    }
    if (ms < ATTACK_WINDUP_MS + ATTACK_LEAN_IN_MS) {
      const t = easeOut(progress(ms, ATTACK_WINDUP_MS, ATTACK_LEAN_IN_MS));
      return {
        ...REST_POSE,
        angle: ATTACK_WINDUP_ANGLE + (ATTACK_LEAN_ANGLE - ATTACK_WINDUP_ANGLE) * t,
        scaleX: 1 + ATTACK_STRETCH * t,
        scaleY: 1 + (ATTACK_STRETCH / 2) * (1 - 2 * t),
      };
    }
    const t =
      1 - easeOut(progress(ms, ATTACK_WINDUP_MS + ATTACK_LEAN_IN_MS, ATTACK_MS - ATTACK_WINDUP_MS - ATTACK_LEAN_IN_MS));
    return {
      ...REST_POSE,
      angle: ATTACK_LEAN_ANGLE * t,
      scaleX: 1 + ATTACK_STRETCH * t,
      scaleY: 1 - (ATTACK_STRETCH / 2) * t,
    };
  }
  if (ms < 0 || ms >= HIT_MS) return null;
  // A damped spring: full strength at the blow, swinging past rest once.
  const t = ms / HIT_MS;
  const spring = Math.cos(1.5 * Math.PI * t) * (1 - t) ** 2;
  return {
    x: -HIT_KNOCKBACK * spring,
    y: 0,
    scaleX: 1 + HIT_SQUASH * spring,
    scaleY: 1 - HIT_SQUASH * spring,
    angle: HIT_ANGLE * spring,
  };
}

// Two poses at once: offsets and tilts add, stretches multiply.
export function combinePoses(a: Pose, b: Pose): Pose {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    scaleX: a.scaleX * b.scaleX,
    scaleY: a.scaleY * b.scaleY,
    angle: a.angle + b.angle,
  };
}

// A unit's whole pose: its motion `motionMs` in, plus an action `actionMs`
// in while it lasts (`framedWalk` as for getMotionPose).
export function getUnitPose(
  motion: RigMotion,
  motionMs: number,
  action: RigAction | null = null,
  actionMs = 0,
  framedWalk = false,
): Pose {
  const base = getMotionPose(motion, motionMs, framedWalk);
  const flourish = action ? getActionPose(action, actionMs) : null;
  return flourish ? combinePoses(base, flourish) : base;
}

// The side a unit's image faces after turning to `facing`: left mirrors it,
// right draws it as is.
export function getRigSide(facing: Facing): RigSide {
  return facing === 'left' ? -1 : 1;
}

// The side a unit faces to look from x `from` toward x `to` (world or grid
// x), keeping `current` when they line up vertically.
export function getSideToward(current: RigSide, from: number, to: number): RigSide {
  if (to > from) return 1;
  if (to < from) return -1;
  return current;
}
