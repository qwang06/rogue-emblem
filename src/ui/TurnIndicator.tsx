import { Frame, TEAM_BANNERS } from './Frame.tsx';
import { GlyphIcon } from './GlyphIcon.tsx';
import { useGameStore } from './useGameStore.ts';

// Header status during the battle, as small GBA-style banners: whose
// phase it is, in its side's color ("Player" on phones, dropping
// "Phase"), the turn number behind a coin, then the objective's icon and
// count (e.g. an hourglass and 2/4 to survive), its name in the tooltip.
// Gone once the battle is decided, so the result, reward and camp screens
// don't show the phase it ended in.
export function TurnIndicator() {
  const turn = useGameStore((state) => state.turn);
  const objective = useGameStore((state) => state.objectiveStatus);
  const decided = useGameStore((state) => state.battleOutcome !== null);
  if (!turn || decided) return null;
  const [side, ...rest] = turn.label.split(' ');

  return (
    <div className={`turn-indicator turn-indicator--${turn.team}`}>
      <Frame as="span" variant={TEAM_BANNERS[turn.team]} className="turn-indicator__phase">
        {side}
        {rest.length > 0 && <span className="turn-indicator__word"> {rest.join(' ')}</span>}
      </Frame>
      <Frame as="span" className="turn-indicator__turn" title={`Turn ${turn.turn}`}>
        <GlyphIcon kind="turn" />
        {turn.turn}
      </Frame>
      {objective && (
        <Frame
          as="span"
          className="turn-indicator__objective"
          title={`${objective.name}: turn ${objective.turn} of ${objective.limit}`}
        >
          <GlyphIcon kind={objective.kind} />
          <span className="visually-hidden">{objective.name} </span>
          {objective.turn}/{objective.limit}
        </Frame>
      )}
    </div>
  );
}
