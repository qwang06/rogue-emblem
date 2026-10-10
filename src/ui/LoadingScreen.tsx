import { WarbandLineup } from './TitleScreen.tsx';
import { useGameStore } from './useGameStore.ts';

// Covers the page while a battle's map loads, so starting one never shows
// a blank canvas: a bar fills with the map scene's load progress, and once
// the map is built (`mapReady`) the screen fades out over it. App mounts it
// only on the battle screen, so every battle starts with it up.
export function LoadingScreen() {
  const progress = useGameStore((state) => state.mapLoadProgress);
  const ready = useGameStore((state) => state.mapReady);
  const percent = Math.round(progress * 100);

  return (
    <div className={ready ? 'loading-screen loading-screen--done' : 'loading-screen'} aria-hidden={ready}>
      <WarbandLineup />
      <p className="loading-screen__label" role="status">
        Preparing the battlefield…
      </p>
      <div
        className="loading-screen__bar"
        role="progressbar"
        aria-label="Loading the map"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="loading-screen__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
