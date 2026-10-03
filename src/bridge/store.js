// Minimal observable store — the only channel between Phaser and React.
// Framework-agnostic: Phaser scenes call setState, React subscribes via
// useSyncExternalStore. State is treated as immutable; setState always
// produces a new top-level object so subscribers can compare by reference.

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  // Accepts a partial object or an updater `(state) => partial`, shallow
  // merges it, and notifies only if some top-level value actually changed.
  function setState(update) {
    const partial = typeof update === 'function' ? update(state) : update;
    const changed = Object.keys(partial).some((key) => !(key in state) || !Object.is(state[key], partial[key]));
    if (!changed) return;

    state = { ...state, ...partial };
    for (const listener of listeners) listener(state);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
