import { useGameStore } from './useGameStore.ts';
import './AutoCommandQueue.css';

export function AutoCommandQueue() {
  const autoPlay = useGameStore((state) => state.autoPlay);
  const queue = useGameStore((state) => state.autoCommandQueue);
  const screen = useGameStore((state) => state.screen);
  const mapReady = useGameStore((state) => state.mapReady);
  // A window that covers the stage (between-stage screens, the result)
  // hides it, so it never sits over a card or a list.
  const covered = useGameStore(
    (state) =>
      state.battleOutcome !== null ||
      state.rewardMenu !== null ||
      state.campMenu !== null ||
      state.rosterScreen !== null ||
      state.merchantScreen !== null ||
      state.equipmentScreen !== null ||
      state.promotionScreen !== null ||
      state.mentorScreen !== null,
  );
  if (!autoPlay || screen !== 'battle' || !mapReady || covered) return null;

  return (
    <section className="panel auto-command-queue" aria-label="Auto command queue">
      <h2>Command queue</h2>
      <ol>
        {queue.length === 0 ? (
          <li className="auto-command-queue__empty">No commands queued</li>
        ) : (
          queue.map((command, index) => <li key={`${index}-${command}`}>{command}</li>)
        )}
      </ol>
    </section>
  );
}
