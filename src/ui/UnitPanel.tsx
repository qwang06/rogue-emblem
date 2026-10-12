import { getUnitSprite } from '../game/tileset.ts';
import { ItemIcon } from './ItemIcon.tsx';
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
// map, laid out like a GBA status window: a framed portrait (the map
// sprite, enlarged, until units have portraits) beside NAME / CLASS / LV
// lines, then labelled HP, MP and (for player units below the level cap)
// EXP bars, a plain grid of stats (RNG is its equipped weapon's), and its
// items (up to six, see MAX_INVENTORY_SLOTS) one per row with their icons
// — potions with their count, weapons with their uses left (∞ if they
// never break) and the equipped one highlighted — long names cut short
// with an ellipsis; left out when it has none. An enemy carrying loot (see
// loot.ts) shows it under a "Drops" line. The team shows as the window's
// color. It sits in the corner away from the hovered unit so it never
// covers it, and steps aside while the combat forecast (which already
// shows both fighters) or the unit info screen (the full sheet, see
// UnitInfoScreen.tsx) is up.
export function UnitPanel() {
  const unit = useGameStore((state) => state.hoveredUnit);
  const anchor = useGameStore((state) => state.hoveredAnchor);
  const forecastOpen = useGameStore((state) => state.combatForecast !== null);
  const infoOpen = useGameStore((state) => state.unitInfo !== null);

  if (!unit || forecastOpen || infoOpen) return null;

  const corner = pickCornerAwayFromTile(anchor);
  const showExperience = unit.team === 'player' && unit.experienceToLevel !== null;
  return (
    <section
      className={`panel unit-panel unit-panel--${unit.team} unit-panel--${corner}`}
      aria-label={`${unit.team === 'enemy' ? 'Enemy' : 'Ally'} ${unit.name}'s stats`}
    >
      <div className="unit-panel__header">
        <span className="unit-panel__portrait">
          <UnitSprite sprite={getUnitSprite(unit.unitClass)} scale={2} />
        </span>
        <dl className="unit-panel__lines">
          <div className="unit-panel__line">
            <dt>Name</dt>
            <dd className="unit-panel__name" title={unit.name}>
              {unit.name}
            </dd>
          </div>
          <div className="unit-panel__line">
            <dt>Class</dt>
            <dd title={unit.classLabel ?? undefined}>{unit.classLabel ?? '–'}</dd>
          </div>
          <div className="unit-panel__line">
            <dt>LV</dt>
            <dd>{unit.level}</dd>
          </div>
        </dl>
      </div>

      <div className="unit-panel__bars">
        <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
        <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
        {showExperience && <Meter label="EXP" value={unit.experience} max={unit.experienceToLevel ?? 0} kind="exp" />}
      </div>

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
              <ItemIcon itemId={item.id} />
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

      {unit.loot && (
        <p className="unit-panel__loot">
          <span className="unit-panel__item-label" title={unit.loot}>
            {unit.loot}
          </span>
          <span className="unit-panel__item-quantity">Drops</span>
        </p>
      )}
    </section>
  );
}

export function Meter({ label, value, max, kind }: { label: string; value: number; max: number; kind: string }) {
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
