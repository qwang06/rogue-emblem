import { useGameStore } from './useGameStore.js';

// Floating damage numbers over units that were just hit. GridScene decides
// where each one appears (as fractions of the map, so it tracks the unit
// however large the map is displayed) and how long it lasts; this only
// draws them and plays the rise-and-fade animation over that duration.
export function DamagePopups() {
  const popups = useGameStore((state) => state.damagePopups);

  return popups.map((popup) => (
    <div
      key={popup.id}
      className="damage-popup"
      style={{ left: `${popup.x * 100}%`, top: `${popup.y * 100}%`, animationDuration: `${popup.durationMs}ms` }}
    >
      {popup.amount}
    </div>
  ));
}
