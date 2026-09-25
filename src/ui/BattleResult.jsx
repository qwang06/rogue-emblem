import { useGameStore } from './useGameStore.js';

const TITLES = { victory: 'Victory', defeat: 'Defeat' };

// Shown over the map once the battle is won or lost. GridScene handles the
// input (confirm returns to the title screen).
export function BattleResult() {
  const outcome = useGameStore((state) => state.battleOutcome);
  if (!outcome) return null;

  return (
    <div className="pause-overlay">
      <section className={`panel battle-result battle-result--${outcome}`} role="alert">
        <h2 className="battle-result__title">{TITLES[outcome]}</h2>
        <p className="battle-result__hint">Enter · Return to title</p>
      </section>
    </div>
  );
}
