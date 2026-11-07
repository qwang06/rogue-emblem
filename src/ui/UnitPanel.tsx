import type { UnitView } from '../bridge/views.ts';
import type { Team } from '../game/turns.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { pickCornerAwayFromTile } from './menuPlacement.ts';
import { RankBadge } from './RankBadge.tsx';
import { StatLabel } from './StatLabel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

const STATS = [
  ['STR', 'strength'],
  ['INT', 'intelligence'],
  ['DEX', 'dexterity'],
  ['SPD', 'speed'],
  ['LCK', 'luck'],
  ['DEF', 'defense'],
  ['RES', 'resistance'],
  ['MOV', 'movement'],
  ['RNG', 'range'],
] as const;

// What the card calls a unit of each team, for screen readers.
const TEAM_NOUNS: Readonly<Record<Team, string>> = { player: 'Ally', enemy: 'Enemy', guest: 'Guest' };

// Compact card for the unit under the cursor, docked in a top corner of the
// map, laid out like a GBA status window: a framed portrait (the map
// sprite, enlarged, until units have portraits) beside NAME / CLASS / LV
// lines (a boss or an elite wearing its map badge on the portrait's
// corner), then HP, MP and (for player units and guests below the level
// cap) EXP bars, a plain grid of stats (RNG is its equipped weapon's), the
// bars and stats each led by its abbreviation (StatLabel), and its items one
// per row with their icons — its worn gear highlighted, then the potions in
// its bag (up to MAX_INVENTORY_SLOTS) with their count — long names cut short with an
// ellipsis; left out when it has none. An enemy carrying loot (see
// loot.ts) shows it under a "Drops" line, and the statuses a skill left on
// it (statuses.ts) show above that, each with its effect as a tooltip. The team shows as the window's
// color. It sits in the corner away from the hovered unit so it never
// covers it, and steps aside while the combat forecast (which already
// shows both fighters) or the unit info screen (the full sheet, see
// UnitInfoScreen.tsx) is up.
//
// `docked`, it's the battle dock's middle readout (BattleDock): a flat
// section of the column rather than a window, always in the same place, so
// it keeps showing while the forecast is up. Otherwise it floats over the
// map, in the corner away from the hovered unit (for windows too narrow for
// the dock; ui.css shows one or the other).
//
// Given a `unit`, it shows that one instead of the hovered unit (the
// attacker beside the forecast), under `heading` when docked.
export function UnitPanel({
  docked = false,
  unit: given,
  heading,
}: {
  docked?: boolean;
  unit?: UnitView;
  heading?: string;
}) {
  const hovered = useGameStore((state) => state.hoveredUnit);
  const anchor = useGameStore((state) => state.hoveredAnchor);
  const forecastOpen = useGameStore((state) => state.combatForecast !== null);
  const infoOpen = useGameStore((state) => state.unitInfo !== null);
  const unit = given ?? hovered;

  if (!unit || (!given && (infoOpen || (forecastOpen && !docked)))) return null;

  const corner = pickCornerAwayFromTile(anchor);
  const showExperience = unit.team !== 'enemy';
  const classes = docked
    ? `dock-section unit-panel unit-panel--docked unit-panel--${unit.team}`
    : `panel unit-panel unit-panel--float unit-panel--${unit.team} unit-panel--${corner}`;
  return (
    <section className={classes} aria-label={`${TEAM_NOUNS[unit.team]} ${unit.name}'s stats`}>
      {heading && docked && <h2 className="dock-section__title">{heading}</h2>}
      <div className="unit-panel__header">
        <span className="unit-panel__portrait">
          <UnitSprite sprite={unit.sprite} scale={2} />
          {unit.rank && <RankBadge rank={unit.rank} scale={2} className="rank-badge--portrait" />}
        </span>
        {docked ? (
          // The name on its own line, then "Villager · Lv 1", as a status strip reads.
          <div className="unit-panel__lines unit-panel__lines--docked">
            <p className="unit-panel__name" title={unit.name}>
              {unit.name}
            </p>
            <p className="unit-panel__class" title={unit.classLabel ?? undefined}>
              <span>{unit.classLabel ?? '–'}</span>
              <span className="unit-panel__level">Lv {unit.level}</span>
            </p>
          </div>
        ) : (
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
        )}
      </div>

      <div className="unit-panel__bars">
        <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
        <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
        {showExperience && <Meter label="EXP" value={unit.experience} max={unit.experienceToLevel} kind="exp" />}
      </div>

      <dl className="unit-panel__stats">
        {STATS.map(([label, key]) => (
          <div key={key} className="unit-panel__stat">
            <dt>
              <StatLabel label={label} />
            </dt>
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
              <span className="unit-panel__item-quantity">{item.quantity === null ? '' : `×${item.quantity}`}</span>
            </li>
          ))}
        </ul>
      )}

      {unit.statuses.length > 0 && (
        <p className="unit-panel__statuses">
          {unit.statuses.map((status) => (
            <span key={status.id} className="unit-panel__status" title={status.description}>
              {status.label}
            </span>
          ))}
        </p>
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
      <span className="meter__label">
        <StatLabel label={label} />
      </span>
      <span className="meter__track">
        <span className="meter__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="meter__value">
        {value}/{max}
      </span>
    </div>
  );
}
