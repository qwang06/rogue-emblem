import { useGameStore } from './useGameStore.ts';

// The "Player Phase" / "Enemy Phase" / "Guest Phase" announcement at the
// start of each phase: a translucent band in the side's color across the
// whole stage, mid-map, as the tactics games cut in. GridScene decides when
// it shows and for how long; this draws it and plays the wipe over that
// duration.
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
