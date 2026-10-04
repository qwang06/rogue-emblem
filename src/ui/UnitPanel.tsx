import { getUnitSprite } from '../game/tileset.ts';
import { pickCornerAwayFromTile } from './menuPlacement.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

const STATS = [
  ['STR', 'strength'],
  ['MAG', 'magic'],
  ['SKL', 'skill'],
  ['SPD', 'speed'],
  ['LCK', 'luck'],
  ['DEF', 'defense'],
  ['RES', 'resistance'],
  ['MOV', 'movement'],
  ['RNG', 'range'],
] as const;

// Compact card for the unit under the cursor, docked in a top corner of the
// map: sprite, name and level (plus XP for player units), thin HP/MP bars,
// a plain grid of stats (RNG is its equipped weapon's), and its items (up
// to six, see MAX_INVENTORY_SLOTS) one per row — potions with their count,
// weapons with their uses left (∞ if they never break) and the equipped
// one in gold — long names cut short with an ellipsis; left out when it
// has none. The team shows as the accent color. It sits in the corner away
// from the hovered unit so it never covers it, and steps aside while the
// combat forecast (which already shows both fighters) is up.
export function UnitPanel() {
  const unit = useGameStore((state) => state.hoveredUnit);
  const anchor = useGameStore((state) => state.hoveredAnchor);
  const forecastOpen = useGameStore((state) => state.combatForecast !== null);

  if (!unit || forecastOpen) return null;

  const corner = pickCornerAwayFromTile(anchor);
  return (
    <section
      className={`panel unit-panel unit-panel--${unit.team} unit-panel--${corner}`}
      aria-label={`${unit.team === 'enemy' ? 'Enemy' : 'Ally'} ${unit.name}'s stats`}
    >
      <div className="unit-panel__header">
        <UnitSprite sprite={getUnitSprite(unit.unitClass)} />
        <div className="unit-panel__identity">
          <h2 className="unit-panel__name">{unit.name}</h2>
          <p className="unit-panel__level">
            Lv {unit.level}
            {unit.team === 'player' && <> · {unit.experience} XP</>}
          </p>
        </div>
      </div>

      <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
      <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />

      <dl className="unit-panel__stats">
        {STATS.map(([label, key]) => (
          <div key={key} className="unit-panel__stat">
            <dt>{label}</dt>
            <dd>{unit[key]}</dd>
          </div>
        ))}
      </dl>

      {unit.items.length > 0 && (
        <ul className="unit-panel__items" aria-label="Items">
          {unit.items.map((item, index) => (
            <li
              key={`${item.id}@${index}`}
              className={item.equipped ? 'unit-panel__item unit-panel__item--equipped' : 'unit-panel__item'}
            >
              <span className="unit-panel__item-label" title={item.equipped ? `${item.label} (equipped)` : item.label}>
                {item.label}
              </span>
              <span className="unit-panel__item-quantity">
                {item.weapon ? (item.quantity ?? '∞') : `×${item.quantity}`}
              </span>
            </li>
          ))}
        </ul>
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
