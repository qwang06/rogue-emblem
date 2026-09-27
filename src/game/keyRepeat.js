// Pure key repeat for held direction keys: which way (if any) to step this
// frame, given which keys are held and which were just pressed. A press
// steps at once; holding the key steps again after `delayMs`, then every
// `intervalMs`. The most recently pressed key that's still held sets the
// direction, so holding right and tapping up steps up, then carries on
// right after the delay once up is let go. No Phaser, no hidden state.

export const KEY_REPEAT = Object.freeze({ delayMs: 250, intervalMs: 75 });

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1 }),
  down: Object.freeze({ dx: 0, dy: 1 }),
  left: Object.freeze({ dx: -1, dy: 0 }),
  right: Object.freeze({ dx: 1, dy: 0 }),
});

const KEYS = Object.keys(DIRECTIONS);

// `held` lists the keys held down, in press order (last is the direction);
// `heldMs` is how long that direction has been held and `nextMs` when it
// next steps.
export function createKeyRepeat() {
  return Object.freeze({ held: Object.freeze([]), heldMs: 0, nextMs: 0 });
}

// Advances the repeat by one frame. `isDown` and `justPressed` are
// { up, down, left, right } booleans for this frame; deltaMs is the time
// since the last frame. Returns { state, step }, where step is a
// DIRECTIONS entry or null. A key pressed and released within one frame
// still steps once.
export function updateKeyRepeat(state, { isDown, justPressed }, deltaMs, timing = KEY_REPEAT) {
  const pressed = KEYS.filter((key) => justPressed[key]);
  const held = [...state.held.filter((key) => isDown[key] && !pressed.includes(key)), ...pressed.filter((key) => isDown[key])];
  const direction = held[held.length - 1] ?? null;

  if (pressed.length > 0) {
    const step = DIRECTIONS[pressed[pressed.length - 1]];
    return { state: Object.freeze({ held: Object.freeze(held), heldMs: 0, nextMs: timing.delayMs }), step };
  }
  if (!direction) return { state: createKeyRepeat(), step: null };

  // Letting go of the newest key hands the direction back to an older one,
  // which waits out the delay again before it repeats.
  if (direction !== state.held[state.held.length - 1]) {
    return { state: Object.freeze({ held: Object.freeze(held), heldMs: 0, nextMs: timing.delayMs }), step: null };
  }

  const heldMs = state.heldMs + deltaMs;
  if (heldMs < state.nextMs) return { state: Object.freeze({ ...state, held: Object.freeze(held), heldMs }), step: null };
  // One step per frame at most, so a long frame can't skip the cursor
  // several tiles. Normally the next step keeps to the schedule; after a
  // frame long enough to miss steps, it comes one interval from now.
  const scheduled = state.nextMs + timing.intervalMs;
  const nextMs = heldMs >= scheduled ? heldMs + timing.intervalMs : scheduled;
  return { state: Object.freeze({ held: Object.freeze(held), heldMs, nextMs }), step: DIRECTIONS[direction] };
}
