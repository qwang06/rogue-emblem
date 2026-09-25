import { useGameStore } from './useGameStore.js';

// The full-width "Player Phase" / "Enemy Phase" announcement at the start
// of each phase. GridScene decides when it shows and for how long; this
// draws it and plays the slide-in/out over that duration.
export function PhaseBanner() {
  const banner = useGameStore((state) => state.phaseBanner);
  if (!banner) return null;

  return (
    <div
      key={banner.id}
      className={`phase-banner phase-banner--${banner.team}`}
      style={{ animationDuration: `${banner.durationMs}ms` }}
      role="status"
    >
      <span className="phase-banner__label">{banner.label}</span>
    </div>
  );
}
