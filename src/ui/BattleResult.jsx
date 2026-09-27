import { gameCommands } from '../bridge/commands.js';
import { useGameStore } from './useGameStore.js';

const TITLES = { victory: 'Victory', defeat: 'Defeat' };

// Shown over the map once the battle is won or lost. GridScene handles the
// input (confirm, or a click, returns to the title screen).
export function BattleResult() {
  const outcome = useGameStore((state) => state.battleOutcome);
  if (!outcome) return null;

  return (
    <div className="pause-overlay">
      <section
        className={`panel battle-result battle-result--${outcome}`}
        role="alert"
        onClick={() => gameCommands.send({ type: 'confirm' })}
      >
        <h2 className="battle-result__title">{TITLES[outcome]}</h2>
        <p className="battle-result__hint">Enter or click · Return to title</p>
      </section>
    </div>
  );
}
