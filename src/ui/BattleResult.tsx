import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';
import { KeyHint } from './KeyHint.tsx';

const TITLES = { victory: 'Victory', defeat: 'Defeat' };

// Shown over the map once the battle is won or lost. GridScene handles the
// input: confirm (or a click) moves on to `nextBattle` after a victory that
// leads to one, else returns to the title screen. When the battle ended a
// Warband Mode run, it says so, with the stage it ended on and the units
// lost along the way. A won stage of a run shows the gold it paid, and
// confirm opens the reward screen (RewardScreen) instead.
export function BattleResult() {
  const outcome = useGameStore((state) => state.battleOutcome);
  const nextBattle = useGameStore((state) => state.nextBattle);
  const runOver = useGameStore((state) => state.runOver);
  const stageClear = useGameStore((state) => state.stageClear);
  const choosingReward = useGameStore((state) => state.rewardMenu !== null);
  if (!outcome || choosingReward) return null;

  return (
    <div className="pause-overlay">
      <section
        className={`panel battle-result battle-result--${outcome}${runOver ? ' battle-result--run-over' : ''}`}
        role="alert"
        onClick={() => gameCommands.send({ type: 'confirm' })}
      >
        <h2 className="battle-result__title">{runOver ? 'The Warband Fell' : TITLES[outcome]}</h2>
        {runOver && (
          <p className="battle-result__detail">
            Fell on stage {runOver.stage}.{runOver.fallen.length > 0 && ` Lost ${runOver.fallen.join(', ')}.`}
          </p>
        )}
        {stageClear && (
          <p className="battle-result__detail">
            +{stageClear.gold} gold{stageClear.flawless && ' (flawless)'}
          </p>
        )}
        <KeyHint
          className="battle-result__hint"
          entries={[
            ['Enter', stageClear ? 'Choose a reward' : nextBattle ? `Continue to ${nextBattle}` : 'Return to title'],
          ]}
        />
      </section>
    </div>
  );
}
