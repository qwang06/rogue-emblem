import { useGameStore } from './useGameStore.js';

// Shows the turn number and whose phase it is, once the battle is under way.
export function TurnIndicator() {
  const turn = useGameStore((state) => state.turn);
  if (!turn) return null;

  return (
    <header className={`panel turn-indicator turn-indicator--${turn.team}`}>
      <span className="turn-indicator__turn">Turn {turn.turn}</span>
      <span className="turn-indicator__phase">{turn.label}</span>
    </header>
  );
}
