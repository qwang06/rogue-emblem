import { useSyncExternalStore } from 'react';
import { gameStore, type GameState } from '../bridge/gameStore.ts';

// Subscribes a component to a slice of the game store. The selector must
// return a value that's stable by reference when unchanged (a stored
// field, not a freshly built object), or the component re-renders forever.
export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useSyncExternalStore(gameStore.subscribe, () => selector(gameStore.getState()));
}
