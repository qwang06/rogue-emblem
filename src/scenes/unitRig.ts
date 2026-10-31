import Phaser from 'phaser';
import type { Facing } from '../game/facing.ts';
import {
  BREATH_MS,
  getActionPose,
  getRigSide,
  getSideToward,
  getUnitPose,
  getWalkFrame,
  type Pose,
  type RigAction,
  type RigMotion,
  type RigSide,
  type WalkFrames,
} from '../game/unitRig.ts';

type Sprite = Phaser.GameObjects.Sprite;
type Part = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

// A single-image unit's animation state (see src/game/unitRig.ts), on the
// scene clock: it runs at the game speed and freezes while the sprite's
// animations are paused (hit-stop, defeat).
interface Rig {
  motion: RigMotion;
  motionMs: number;
  action: RigAction | null;
  actionMs: number;
  side: RigSide;
  // The unit's own image, and its frame-by-frame walk if it has one.
  image: string;
  walk: WalkFrames | undefined;
}

const rigs = new WeakMap<Sprite, Rig>();

// The transform a part had before it was posed, put back after the frame
// draws.
interface Saved {
  x: number;
  y: number;
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

// Draws `part` in `pose` facing `side`: moved, stretched and tilted about the
// bottom middle of where it's drawn (the unit's feet). Returns what to put
// back.
function applyPose(part: Part, pose: Pose, side: RigSide): Saved {
  const saved = {
    x: part.x,
    y: part.y,
    originX: part.originX,
    originY: part.originY,
    scaleX: part.scaleX,
    scaleY: part.scaleY,
    angle: part.angle,
  };
  const width = part.displayWidth;
  const height = part.displayHeight;
  const footX = part.x + (0.5 - part.originX) * width;
  const footY = part.y + (1 - part.originY) * height;
  part
    .setOrigin(0.5, 1)
    .setPosition(footX + pose.x * side * width, footY + pose.y * height)
    .setScale(saved.scaleX * pose.scaleX, saved.scaleY * pose.scaleY)
    .setAngle(saved.angle + pose.angle * side);
  return saved;
}

function restore(part: Part, saved: Saved): void {
  part
    .setOrigin(saved.originX, saved.originY)
    .setPosition(saved.x, saved.y)
    .setScale(saved.scaleX, saved.scaleY)
    .setAngle(saved.angle);
}

// Animates a single-image unit's sprite in code: it breathes, and walks,
// attacks and flinches as setRigMotion / playRigAction say, starting out
// facing `side`. The pose is only applied while the frame draws, so the
// sprite's position, size and origin stay the tile-anchored ones every
// tween and follower (shadow, badge) works with. `parts` (its outline) are
// posed with it. A unit with `walk` frames shows them while it walks instead
// of hopping. Torn down with the sprite.
export function addUnitRig(
  scene: Phaser.Scene,
  sprite: Sprite,
  side: RigSide,
  parts: readonly Part[] = [],
  walk?: WalkFrames,
): void {
  // Units start at different points of a breath, so a line of them doesn't
  // breathe in step.
  const rig: Rig = {
    motion: 'idle',
    motionMs: Math.random() * BREATH_MS,
    action: null,
    actionMs: 0,
    side,
    image: sprite.texture.key,
    walk,
  };
  rigs.set(sprite, rig);
  sprite.setFlipX(side < 0);
  const posed = [sprite, ...parts];
  let saved: Saved[] = [];

  const tick = (_time: number, delta: number) => {
    if (sprite.anims.isPaused) return;
    const ms = delta * scene.time.timeScale;
    rig.motionMs += ms;
    showFrame(sprite, rig);
    if (!rig.action) return;
    rig.actionMs += ms;
    if (!getActionPose(rig.action, rig.actionMs)) rig.action = null;
  };
  const pose = () => {
    const current = getUnitPose(rig.motion, rig.motionMs, rig.action, rig.actionMs, rig.walk !== undefined);
    saved = posed.map((part) => applyPose(part, current, rig.side));
  };
  const unpose = () => {
    posed.forEach((part, i) => {
      if (saved[i] && part.active) restore(part, saved[i]);
    });
    saved = [];
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, pose);
  scene.events.on(Phaser.Scenes.Events.RENDER, unpose);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, pose);
    scene.events.off(Phaser.Scenes.Events.RENDER, unpose);
    rigs.delete(sprite);
  });
}

// Whether a sprite is a single-image unit animated by addUnitRig.
export function hasUnitRig(sprite: Sprite): boolean {
  return rigs.has(sprite);
}

// Shows the walk frame for the moment while a unit with walk frames walks,
// else its own image. Run before the outline and shadows follow the sprite
// (POST_UPDATE), so they draw the same frame.
function showFrame(sprite: Sprite, rig: Rig): void {
  if (!rig.walk) return;
  if (rig.motion === 'move') {
    const frame = getWalkFrame(rig.walk, rig.motionMs);
    if (sprite.texture.key !== rig.walk.key || String(sprite.frame.name) !== String(frame)) {
      sprite.setTexture(rig.walk.key, frame);
    }
  } else if (sprite.texture.key !== rig.image) sprite.setTexture(rig.image);
}

function turn(sprite: Sprite, rig: Rig, side: RigSide): void {
  rig.side = side;
  sprite.setFlipX(side < 0);
}

// Starts a rigged unit standing or walking (a walk keeps its stride if it's
// already walking), turned toward `facing`.
export function setRigMotion(sprite: Sprite, motion: RigMotion, facing: Facing): void {
  const rig = rigs.get(sprite);
  if (!rig) return;
  if (rig.motion !== motion) {
    rig.motion = motion;
    rig.motionMs = 0;
    showFrame(sprite, rig);
  }
  turn(sprite, rig, getRigSide(facing));
}

// Turns a rigged unit to look toward world x `x`.
export function faceRigToward(sprite: Sprite, x: number): void {
  const rig = rigs.get(sprite);
  if (rig) turn(sprite, rig, getSideToward(rig.side, sprite.x, x));
}

// Plays an attack or a flinch over a rigged unit's motion, from the start.
export function playRigAction(sprite: Sprite, action: RigAction): void {
  const rig = rigs.get(sprite);
  if (!rig) return;
  rig.action = action;
  rig.actionMs = 0;
}
