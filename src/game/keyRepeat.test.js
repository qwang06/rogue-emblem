import { describe, expect, it } from 'vitest';
import { DIRECTIONS, createKeyRepeat, updateKeyRepeat } from './keyRepeat.js';

const timing = { delayMs: 200, intervalMs: 50 };
const none = { up: false, down: false, left: false, right: false };
const keys = (...names) => ({ ...none, ...Object.fromEntries(names.map((name) => [name, true])) });

// Runs frames of { down: [...held keys], pressed: [...just pressed], ms }
// from a fresh repeat, returning the step taken on each frame.
function run(frames) {
  let state = createKeyRepeat();
  return frames.map(({ down = [], pressed = [], ms = 16 }) => {
    const result = updateKeyRepeat(state, { isDown: keys(...down), justPressed: keys(...pressed) }, ms, timing);
    state = result.state;
    return result.step;
  });
}

describe('updateKeyRepeat', () => {
  it('steps once, right away, when a key is pressed', () => {
    expect(run([{ down: ['right'], pressed: ['right'] }])).toEqual([DIRECTIONS.right]);
  });

  it('does nothing with no keys', () => {
    expect(run([{}, {}])).toEqual([null, null]);
  });

  it('waits out the delay before repeating, then repeats every interval', () => {
    const steps = run([
      { down: ['down'], pressed: ['down'], ms: 0 },
      { down: ['down'], ms: 199 },
      { down: ['down'], ms: 1 }, // 200: the delay is up
      { down: ['down'], ms: 49 },
      { down: ['down'], ms: 1 }, // 250: one interval later
      { down: ['down'], ms: 50 }, // 300
    ]);
    expect(steps).toEqual([DIRECTIONS.down, null, DIRECTIONS.down, null, DIRECTIONS.down, DIRECTIONS.down]);
  });

  it('stops when the key is let go, and starts over on the next press', () => {
    const steps = run([
      { down: ['left'], pressed: ['left'], ms: 0 },
      { down: ['left'], ms: 150 },
      {},
      { down: ['left'], pressed: ['left'], ms: 16 },
      { down: ['left'], ms: 150 },
    ]);
    expect(steps).toEqual([DIRECTIONS.left, null, null, DIRECTIONS.left, null]);
  });

  it('turns to a newly pressed key while an older one is still held', () => {
    const steps = run([
      { down: ['right'], pressed: ['right'], ms: 0 },
      { down: ['right', 'up'], pressed: ['up'], ms: 100 },
      { down: ['right', 'up'], ms: 200 },
    ]);
    expect(steps).toEqual([DIRECTIONS.right, DIRECTIONS.up, DIRECTIONS.up]);
  });

  it('goes back to the older key after the newer one is let go, after the delay', () => {
    const steps = run([
      { down: ['right'], pressed: ['right'], ms: 0 },
      { down: ['right', 'up'], pressed: ['up'], ms: 16 },
      { down: ['right'], ms: 16 }, // up let go: no extra step
      { down: ['right'], ms: 199 },
      { down: ['right'], ms: 1 },
    ]);
    expect(steps).toEqual([DIRECTIONS.right, DIRECTIONS.up, null, null, DIRECTIONS.right]);
  });

  it('never moves diagonally when two keys go down together', () => {
    const [step] = run([{ down: ['up', 'left'], pressed: ['up', 'left'] }]);
    expect([DIRECTIONS.up, DIRECTIONS.left]).toContain(step);
  });

  it('steps for a tap that is pressed and let go within one frame', () => {
    expect(run([{ pressed: ['down'] }, {}])).toEqual([DIRECTIONS.down, null]);
  });

  it('steps at most once in a long frame', () => {
    const steps = run([
      { down: ['right'], pressed: ['right'], ms: 0 },
      { down: ['right'], ms: 1000 },
      { down: ['right'], ms: 16 },
      { down: ['right'], ms: 50 },
    ]);
    expect(steps).toEqual([DIRECTIONS.right, DIRECTIONS.right, null, DIRECTIONS.right]);
  });

  it('returns frozen state', () => {
    const { state } = updateKeyRepeat(createKeyRepeat(), { isDown: keys('up'), justPressed: keys('up') }, 16, timing);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.held)).toBe(true);
  });
});
