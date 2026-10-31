import { describe, expect, it } from 'vitest';
import {
  ATTACK_MS,
  BREATH_MS,
  HIT_MS,
  HOP_MS,
  REST_POSE,
  combinePoses,
  getActionPose,
  getMotionPose,
  getRigSide,
  getSideToward,
  getUnitPose,
} from './unitRig.ts';

describe('getMotionPose', () => {
  it('stands at rest at the start of a breath and halfway through it', () => {
    expect(getMotionPose('idle', 0)).toEqual(REST_POSE);
    const half = getMotionPose('idle', BREATH_MS / 2);
    expect(half.scaleY).toBeCloseTo(1);
    expect(half.scaleX).toBeCloseTo(1);
  });

  it('stretches up and thins while breathing in, the reverse breathing out', () => {
    const inhale = getMotionPose('idle', BREATH_MS / 4);
    expect(inhale.scaleY).toBeGreaterThan(1);
    expect(inhale.scaleX).toBeLessThan(1);
    const exhale = getMotionPose('idle', (BREATH_MS * 3) / 4);
    expect(exhale.scaleY).toBeLessThan(1);
    expect(exhale.scaleX).toBeGreaterThan(1);
  });

  it('never moves or tilts a standing unit', () => {
    for (let ms = 0; ms < BREATH_MS; ms += 100) {
      const pose = getMotionPose('idle', ms);
      expect([pose.x, pose.y, pose.angle]).toEqual([0, 0, 0]);
    }
  });

  it('hops once per step, highest midway and on the ground between', () => {
    expect(getMotionPose('move', 0).y).toBeCloseTo(0);
    expect(getMotionPose('move', HOP_MS).y).toBeCloseTo(0);
    const top = getMotionPose('move', HOP_MS / 2);
    expect(top.y).toBeLessThan(0);
    expect(top.scaleY).toBeCloseTo(1);
  });

  it('squashes on landing and rocks to alternate sides each hop', () => {
    const landing = getMotionPose('move', HOP_MS);
    expect(landing.scaleY).toBeLessThan(1);
    expect(landing.scaleX).toBeGreaterThan(1);
    expect(getMotionPose('move', HOP_MS / 2).angle).toBeGreaterThan(0);
    expect(getMotionPose('move', (HOP_MS * 3) / 2).angle).toBeLessThan(0);
  });
});

describe('getActionPose', () => {
  it('lasts only as long as the action', () => {
    expect(getActionPose('attack', -1)).toBeNull();
    expect(getActionPose('attack', ATTACK_MS)).toBeNull();
    expect(getActionPose('hit', HIT_MS)).toBeNull();
    expect(getActionPose('attack', 0)).not.toBeNull();
    expect(getActionPose('hit', 0)).not.toBeNull();
  });

  it('winds up leaning back, then leans into the swing', () => {
    expect(getActionPose('attack', 80)!.angle).toBeLessThan(0);
    expect(getActionPose('attack', 260)!.angle).toBeGreaterThan(0);
  });

  it('eases back upright as the attack ends', () => {
    const late = getActionPose('attack', ATTACK_MS - 1)!;
    expect(late.angle).toBeCloseTo(0, 1);
    expect(late.scaleX).toBeCloseTo(1, 2);
  });

  it('knocks a hit unit back, squashed and tilted away, at the blow', () => {
    const blow = getActionPose('hit', 0)!;
    expect(blow.x).toBeLessThan(0);
    expect(blow.angle).toBeLessThan(0);
    expect(blow.scaleY).toBeLessThan(1);
  });

  it('springs past rest once before settling', () => {
    const angles = Array.from({ length: HIT_MS / 10 }, (_, i) => getActionPose('hit', i * 10)!.angle);
    expect(Math.max(...angles)).toBeGreaterThan(0);
    expect(Math.abs(angles[angles.length - 1])).toBeLessThan(0.5);
  });
});

describe('combinePoses', () => {
  it('adds offsets and tilts and multiplies stretches', () => {
    const a = { x: 0.1, y: -0.1, scaleX: 1.1, scaleY: 0.9, angle: 5 };
    const b = { x: 0.2, y: 0.05, scaleX: 2, scaleY: 2, angle: -3 };
    const pose = combinePoses(a, b);
    expect(pose.x).toBeCloseTo(0.3);
    expect(pose.y).toBeCloseTo(-0.05);
    expect(pose.scaleX).toBeCloseTo(2.2);
    expect(pose.scaleY).toBeCloseTo(1.8);
    expect(pose.angle).toBe(2);
  });

  it('leaves a pose alone combined with rest', () => {
    const pose = getMotionPose('move', 50);
    expect(combinePoses(pose, REST_POSE)).toEqual(pose);
  });
});

describe('getUnitPose', () => {
  it('is the motion alone with no action, or once the action is over', () => {
    expect(getUnitPose('idle', 300)).toEqual(getMotionPose('idle', 300));
    expect(getUnitPose('idle', 300, 'hit', HIT_MS)).toEqual(getMotionPose('idle', 300));
  });

  it('layers an action over the motion while it lasts', () => {
    expect(getUnitPose('move', 30, 'hit', 0)).toEqual(
      combinePoses(getMotionPose('move', 30), getActionPose('hit', 0)!),
    );
  });
});

describe('getRigSide', () => {
  it('faces left mirrored and right as drawn', () => {
    expect(getRigSide('left')).toBe(-1);
    expect(getRigSide('right')).toBe(1);
  });
});

describe('getSideToward', () => {
  it('turns toward the other x, or keeps its side straight above or below', () => {
    expect(getSideToward(1, 5, 2)).toBe(-1);
    expect(getSideToward(-1, 2, 5)).toBe(1);
    expect(getSideToward(-1, 3, 3)).toBe(-1);
  });
});
