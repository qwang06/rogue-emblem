import { Frame } from './Frame.tsx';
import { useGameStore } from './useGameStore.ts';

// Header status during the battle, as two small GBA-style banners: whose
// phase it is, in its side's color, then the turn number (just the
// number on phones).
export function TurnIndicator() {
  const turn = useGameStore((state) => state.turn);
  if (!turn) return null;

  return (
    <div className={`turn-indicator turn-indicator--${turn.team}`}>
      <Frame as="span" variant={turn.team === 'enemy' ? 'banner-red' : 'banner'} className="turn-indicator__phase">
        {turn.label}
      </Frame>
      <Frame as="span" className="turn-indicator__turn">
        <span className="turn-indicator__word">Turn </span>
        {turn.turn}
      </Frame>
    </div>
  );
}
