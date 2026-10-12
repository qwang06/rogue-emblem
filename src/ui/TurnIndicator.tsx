import { useGameStore } from './useGameStore.ts';

// Header status during the battle, as two small GBA-style banners: whose
// phase it is, in its side's color, then the turn number.
export function TurnIndicator() {
  const turn = useGameStore((state) => state.turn);
  if (!turn) return null;

  return (
    <div className={`turn-indicator turn-indicator--${turn.team}`}>
      <span className="turn-indicator__phase">{turn.label}</span>
      <span className="turn-indicator__turn">Turn {turn.turn}</span>
    </div>
  );
}
