import { Frame } from './Frame.tsx';
import { useGameStore } from './useGameStore.ts';

// The "Player Phase" / "Enemy Phase" announcement at the start of each
// phase: a gold-framed banner in the side's color, mid-map. GridScene decides when it shows and for how long; this
// draws it and plays the slide-in/out over that duration.
export function PhaseBanner() {
  const banner = useGameStore((state) => state.phaseBanner);
  if (!banner) return null;

  return (
    <Frame
      as="div"
      key={banner.id}
      variant={banner.team === 'enemy' ? 'banner-red' : 'banner'}
      className={`phase-banner phase-banner--${banner.team}`}
      style={{ animationDuration: `${banner.durationMs}ms` }}
      role="status"
    >
      <span className="phase-banner__label">{banner.label}</span>
    </Frame>
  );
}
