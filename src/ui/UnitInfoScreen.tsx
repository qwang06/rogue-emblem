import { WEAPON_TYPE_LABELS } from '../game/weapons.ts';
import { MenuExitButton } from './MenuExitButton.tsx';
import { gameCommands } from '../bridge/commands.ts';
import type { UnitDetailView } from '../bridge/views.ts';
import { getExperienceForLevel } from '../game/experience.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { getRankLabel, RankBadge } from './RankBadge.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';
import { StatLabel } from './StatLabel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { WeaponNumbers } from './WeaponNumbers.tsx';
import { Meter } from './UnitPanel.tsx';
import { useGameStore } from './useGameStore.ts';
import './UnitInfoScreen.css';
import { KeyHint } from './KeyHint.tsx';

// The unit info screen: a full stat sheet for the unit the cursor was on
// when I was pressed, over a dimmed map. On the left, who it is (sprite,
// name, class, level, HP/MP bars and an EXP bar for player units, movement,
// the weapon types it can wield, and its quirk); then each stat with a bar
// filled toward its class's cap, with its passive boons under them; then
// the rates it fights with, its equipped weapon's numbers as icon chips
// (WeaponNumbers), its items with their icons and its skills with their MP
// and range. Stats are labelled with their abbreviation (StatLabel). The
// hover UnitPanel stays the quick view. GridScene handles the
// input (I, confirm or cancel closes it), and a click anywhere closes it
// too.
export function UnitInfoScreen() {
  const unit = useGameStore((state) => state.unitInfo);
  if (!unit) return null;

  return (
    <div className="pause-overlay unit-info-layer" onClick={() => gameCommands.send({ type: 'cancel' })}>
      <div className="unit-info-window">
        <section className={`panel unit-info unit-info--${unit.team}`} role="dialog" aria-labelledby="unit-info-name">
          <Identity unit={unit} />
          <Stats unit={unit} />
          <Combat unit={unit} />
          <KeyHint className="unit-info__hint" entries={[['I', 'Close']]} />
        </section>
        <MenuExitButton kind="close" />
      </div>
    </div>
  );
}

function Identity({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="unit-info__identity">
      <div className="unit-info__portrait">
        <span className="unit-info__sprite">
          <UnitSprite sprite={unit.sprite} scale={2} animated />
          {unit.rank && <RankBadge rank={unit.rank} scale={2} className="rank-badge--portrait" />}
        </span>
      </div>
      <h2 className="unit-info__name" id="unit-info-name">
        {unit.name}
      </h2>
      <p className="unit-info__class">
        {unit.classLabel ?? 'No class'}, level {unit.level}
        {unit.rank && ` · ${getRankLabel(unit.rank)}`}
      </p>
      <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
      <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
      {unit.team !== 'enemy' && (
        <Meter label="EXP" value={unit.experience} max={getExperienceForLevel(unit.level)} kind="exp" />
      )}
      <dl className="unit-info__pairs">
        <div>
          <dt>
            <StatLabel label="MOV" />
          </dt>
          <dd>{unit.movement}</dd>
        </div>
        <div>
          <dt>Trained</dt>
          <dd>
            {unit.weaponTypes.length > 0 ? unit.weaponTypes.map((type) => WEAPON_TYPE_LABELS[type]).join(', ') : '–'}
          </dd>
        </div>
      </dl>
      {unit.quirk && (
        <>
          <h3 className="unit-info__heading">Quirk</h3>
          <ul className="unit-info__list unit-info__list--boons">
            <li>
              <span>{unit.quirk.label}</span>
              <span>{unit.quirk.description}</span>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

// Each stat as a label, its value and a bar sized against the unit's
// highest stat (stats have no caps), so the bars show the build's shape.
function Stats({ unit }: { unit: UnitDetailView }) {
  const highest = Math.max(1, ...unit.stats.map((stat) => stat.value));
  return (
    <div className="unit-info__column">
      <h3 className="unit-info__heading">Stats</h3>
      <dl className="unit-info__stats">
        {unit.stats.map((stat) => {
          const percent = (Math.max(0, stat.value) / highest) * 100;
          return (
            <div key={stat.id} className="unit-info__stat">
              <dt>
                <StatLabel label={stat.label} />
              </dt>
              <span className="unit-info__stat-track" aria-hidden="true">
                <span className="unit-info__stat-fill" style={{ width: `${percent}%` }} />
              </span>
              <dd>{stat.value}</dd>
            </div>
          );
        })}
      </dl>
      <Passives unit={unit} />
    </div>
  );
}

// Passive boons, under the stats, where the column has room to spare
// beside the longer combat column.
function Passives({ unit }: { unit: UnitDetailView }) {
  return (
    <>
      {unit.passives.length > 0 && (
        <>
          <h3 className="unit-info__heading">Passives</h3>
          <ul className="unit-info__list unit-info__list--boons">
            {unit.passives.map((passive) => (
              <li key={passive.id}>
                <span>{passive.label}</span>
                <span>{passive.description}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Combat({ unit }: { unit: UnitDetailView }) {
  const weapon = unit.equippedWeapon;
  return (
    <div className="unit-info__column">
      <h3 className="unit-info__heading">Combat</h3>
      <dl className="unit-info__rates">
        <Rate label={unit.damageType === 'magical' ? 'Atk (mag)' : 'Atk'} icon="attack" value={unit.attack} />
        <Rate label="Hit" icon="hit" value={unit.hit} />
        <Rate label="Avoid" icon="avoid" value={unit.avoid} />
        <Rate label="Crit" icon="crit" value={unit.crit} />
        <Rate label="AS" value={unit.attackSpeed} />
        <Rate label="RNG" value={unit.range} />
      </dl>

      <h3 className="unit-info__heading">Weapon</h3>
      {weapon ? (
        <p className="unit-info__weapon">
          <span className="unit-info__weapon-name">{weapon.label}</span>
          <WeaponNumbers power={weapon.power} hit={weapon.hit} crit={weapon.crit} weight={weapon.weight} />
        </p>
      ) : (
        <p className="unit-info__empty">None</p>
      )}

      <h3 className="unit-info__heading">Items</h3>
      {unit.items.length > 0 ? (
        <ul className="unit-info__list">
          {unit.items.map((item, index) => (
            <li key={`${item.id}@${index}`} className={item.equipped ? 'unit-info__item--equipped' : undefined}>
              <span className="unit-info__item">
                <ItemIcon itemId={item.id} />
                {item.label}
              </span>
              <span>{item.quantity === null ? '' : `×${item.quantity}`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="unit-info__empty">None</p>
      )}

      <h3 className="unit-info__heading">
        Skills{unit.secondaryClass && <span className="unit-info__secondary"> + {unit.secondaryClass} set</span>}
      </h3>
      {unit.skills.length > 0 ? (
        <ul className="unit-info__list">
          {unit.skills.map((skill) => (
            <li key={skill.id}>
              <span>{skill.label}</span>
              <span className="unit-info__skill-cost" title={`Costs ${skill.manaCost} MP, range ${skill.range}`}>
                {skill.manaCost} MP · Rng {skill.range}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="unit-info__empty">None</p>
      )}
    </div>
  );
}

// A combat rate, its label led by the forecast's icon where it has one.
function Rate({ label, icon, value }: { label: string; icon?: StatIconKind; value: number | string }) {
  return (
    <div className="unit-info__rate">
      <dt>
        {icon ? <StatIcon kind={icon} /> : <span className="unit-info__no-icon" />}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
