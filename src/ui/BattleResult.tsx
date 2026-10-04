import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';

const TITLES = { victory: 'Victory', defeat: 'Defeat' };

// Shown over the map once the battle is won or lost. GridScene handles the
// input: confirm (or a click) moves on to `nextBattle` after a victory that
// leads to one, else returns to the title screen.
export function BattleResult() {
  const outcome = useGameStore((state) => state.battleOutcome);
  const nextBattle = useGameStore((state) => state.nextBattle);
  if (!outcome) return null;

  return (
    <div className="pause-overlay">
      <section
        className={`panel battle-result battle-result--${outcome}`}
        role="alert"
        onClick={() => gameCommands.send({ type: 'confirm' })}
      >
        <h2 className="battle-result__title">{TITLES[outcome]}</h2>
        <p className="battle-result__hint">
          Enter or click · {nextBattle ? `Continue to ${nextBattle}` : 'Return to title'}
        </p>
      </section>
    </div>
  );
}
