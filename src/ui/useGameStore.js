import { useSyncExternalStore } from 'react';
import { gameStore } from '../bridge/gameStore.js';

// Subscribes a component to a slice of the game store. The selector must
// return a value that's stable by reference when unchanged (a stored
// field, not a freshly built object), or the component re-renders forever.
export function useGameStore(selector) {
  return useSyncExternalStore(gameStore.subscribe, () => selector(gameStore.getState()));
}
