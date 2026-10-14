import { Frame } from './Frame.tsx';
import { useGameStore } from './useGameStore.ts';

// Header status during the battle, as small GBA-style banners: whose
// phase it is, in its side's color, the turn number (just the number on
// phones), then the objective's short readout (e.g. "Survive 2/4").
export function TurnIndicator() {
  const turn = useGameStore((state) => state.turn);
  const objectiveStatus = useGameStore((state) => state.objectiveStatus);
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
      {objectiveStatus && (
        <Frame as="span" className="turn-indicator__objective">
          {objectiveStatus}
        </Frame>
      )}
    </div>
  );
}
