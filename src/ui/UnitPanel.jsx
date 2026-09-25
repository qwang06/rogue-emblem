import { UNIT_FRAMES } from '../game/tileset.js';
import { UnitSprite } from './UnitSprite.jsx';
import { useGameStore } from './useGameStore.js';

// Sidebar card for the unit under the cursor: portrait, level, HP/MP
// meters, and combat stats. Holds its place with a hint when nothing is
// hovered, so the sidebar doesn't jump around.
export function UnitPanel() {
  const unit = useGameStore((state) => state.hoveredUnit);

  if (!unit) {
    return (
      <section className="side-panel unit-panel unit-panel--empty">
        <h2 className="side-panel__title">Unit</h2>
        <p className="unit-panel__placeholder">Hover a unit to see its stats</p>
      </section>
    );
  }

  return (
    <section className={`side-panel unit-panel unit-panel--${unit.team}`}>
      <h2 className="side-panel__title">{unit.team === 'enemy' ? 'Enemy' : 'Ally'}</h2>
      <div className="unit-panel__header">
        <span className="unit-panel__portrait">
          <UnitSprite frame={UNIT_FRAMES[unit.team]} scale={3} />
        </span>
        <div>
          <p className="unit-panel__name">{unit.name}</p>
          <p className="unit-panel__level">Level {unit.level}</p>
        </div>
      </div>

      <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
      <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />

      <dl className="unit-panel__stats">
        <Stat label="ATK" value={unit.attack} />
        <Stat label="DEF" value={unit.defense} />
        <Stat label="MOV" value={unit.movement} />
        <Stat label="RNG" value={unit.range} />
      </dl>
    </section>
  );
}

function Meter({ label, value, max, kind }) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={`meter meter--${kind}`}>
      <span className="meter__label">{label}</span>
      <span className="meter__track">
        <span className="meter__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="meter__value">
        {value}/{max}
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="unit-panel__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
