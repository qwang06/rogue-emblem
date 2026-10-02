import { useGameStore } from './useGameStore.js';

// Floating numbers over units: damage when one is hit ("Crit! N" on a
// crit, "Miss" when a strike misses), or "+N HP" / "+N MP" (colored by
// kind) when one recovers. GridScene decides
// where each one appears (as fractions of the map, so it tracks the unit
// however large the map is displayed) and how long it lasts; this only
// draws them and plays the rise-and-fade animation over that duration.
export function DamagePopups() {
  const popups = useGameStore((state) => state.damagePopups);

  return popups.map((popup) => (
    <div
      key={popup.id}
      className={`damage-popup damage-popup--${popup.kind}`}
      style={{ left: `${popup.x * 100}%`, top: `${popup.y * 100}%`, animationDuration: `${popup.durationMs}ms` }}
    >
      {popup.text}
    </div>
  ));
}
