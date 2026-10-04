import { gameCommands } from '../bridge/commands.ts';
import { useGameStore } from './useGameStore.ts';

// Shown over the map before the battle starts (after the opening dialog):
// what wins the battle and what loses it. GridScene handles the input
// (confirm, cancel or a click carries on).
export function ObjectiveScreen() {
  const objective = useGameStore((state) => state.objective);
  if (!objective) return null;

  return (
    <div className="pause-overlay objective-layer" onClick={() => gameCommands.send({ type: 'confirm' })}>
      <section className="panel objective" role="dialog" aria-labelledby="objective-title">
        <p className="objective__battle">{objective.battle}</p>
        <h2 className="objective__title" id="objective-title">
          Objective
        </h2>
        <p className="objective__goal">{objective.goal}</p>
        <p className="objective__defeat">
          <span className="objective__label">Defeat</span> {objective.defeat}
        </p>
        <p className="objective__hint">Enter or click · Continue</p>
      </section>
    </div>
  );
}
