import { getUnitSprite } from '../game/tileset.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// Sidebar card for the unit under the cursor: portrait, level (and XP
// for player units), HP/MP
// meters, combat stats, and the items it carries. Holds its place with a hint when nothing is
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
          <UnitSprite sprite={getUnitSprite(unit.unitClass)} scale={2} />
        </span>
        <div>
          <p className="unit-panel__name">{unit.name}</p>
          <p className="unit-panel__level">
            Level {unit.level}
            {unit.team === 'player' && <span className="unit-panel__experience"> · EXP {unit.experience}</span>}
          </p>
        </div>
      </div>

      <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
      <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />

      <dl className="unit-panel__stats">
        <Stat label="STR" value={unit.strength} />
        <Stat label="MAG" value={unit.magic} />
        <Stat label="SKL" value={unit.skill} />
        <Stat label="SPD" value={unit.speed} />
        <Stat label="LCK" value={unit.luck} />
        <Stat label="DEF" value={unit.defense} />
        <Stat label="RES" value={unit.resistance} />
        <Stat label="MOV" value={unit.movement} />
        <Stat label="RNG" value={unit.range} />
      </dl>

      <h3 className="unit-panel__subtitle">Items</h3>
      {unit.items.length > 0 ? (
        <ul className="unit-panel__items">
          {unit.items.map((item) => (
            <li key={item.id} className="unit-panel__item">
              <span>{item.label}</span>
              <span className="unit-panel__item-quantity">×{item.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="unit-panel__no-items">None</p>
      )}
    </section>
  );
}

function Meter({ label, value, max, kind }: { label: string; value: number; max: number; kind: string }) {
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="unit-panel__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
