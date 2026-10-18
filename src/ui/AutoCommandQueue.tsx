import { useGameStore } from './useGameStore.ts';
import './AutoCommandQueue.css';

export function AutoCommandQueue() {
  const autoPlay = useGameStore((state) => state.autoPlay);
  const queue = useGameStore((state) => state.autoCommandQueue);
  const screen = useGameStore((state) => state.screen);
  const mapReady = useGameStore((state) => state.mapReady);
  if (!autoPlay || screen !== 'battle' || !mapReady) return null;

  return (
    <section className="auto-command-queue" aria-label="Auto command queue">
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
