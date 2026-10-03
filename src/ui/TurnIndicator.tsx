import { useGameStore } from './useGameStore.ts';

// Header status during the battle: the turn number and whose phase it is.
export function TurnIndicator() {
  const turn = useGameStore((state) => state.turn);
  if (!turn) return null;

  return (
    <div className={`turn-indicator turn-indicator--${turn.team}`}>
      <span className="turn-indicator__turn">Turn {turn.turn}</span>
      <span className="turn-indicator__phase">{turn.label}</span>
    </div>
  );
}
