import { gameCommands } from '../bridge/commands.ts';
import type { UnitDetailView } from '../bridge/views.ts';
import { getExperienceForLevel } from '../game/experience.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { Meter } from './UnitPanel.tsx';
import { useGameStore } from './useGameStore.ts';
import './UnitInfoScreen.css';
import { KeyHint } from './KeyHint.tsx';

const WEAPON_TYPE_LABELS = { physical: 'Physical', magical: 'Magic', siege: 'Siege' } as const;

// The unit info screen: a full stat sheet for the unit the cursor was on
// when I was pressed, over a dimmed map. On the left, who it is (sprite,
// name, class, level and XP for player units, HP/MP bars, movement and the
// weapon types it can wield); then each stat with a bar filled toward its
// class's cap; then the rates it fights with, its equipped weapon's
// numbers, its items and its skills. The hover UnitPanel stays the quick
// view. GridScene handles the input (I, confirm or cancel closes it), and
// a click anywhere closes it too.
export function UnitInfoScreen() {
  const unit = useGameStore((state) => state.unitInfo);
  if (!unit) return null;

  return (
    <div className="pause-overlay unit-info-layer" onClick={() => gameCommands.send({ type: 'cancel' })}>
      <section className={`panel unit-info unit-info--${unit.team}`} role="dialog" aria-labelledby="unit-info-name">
        <Identity unit={unit} />
        <Stats unit={unit} />
        <Combat unit={unit} />
        <KeyHint className="unit-info__hint" entries={[['I', 'Close']]} />
      </section>
    </div>
  );
}

function Identity({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="unit-info__identity">
      <div className="unit-info__portrait">
        <UnitSprite sprite={getUnitSprite(unit.unitClass)} scale={2} animated />
      </div>
      <h2 className="unit-info__name" id="unit-info-name">
        {unit.name}
      </h2>
      <p className="unit-info__class">
        {unit.classLabel ?? 'No class'}, level {unit.level}
      </p>
      {unit.team === 'player' && (
        <p className="unit-info__xp">
          {unit.maxLevel ? 'Max level' : `XP ${unit.experience}/${getExperienceForLevel(unit.level)}`}
        </p>
      )}
      <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
      <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
      <dl className="unit-info__pairs">
        <div>
          <dt>MOV</dt>
          <dd>{unit.movement}</dd>
        </div>
        <div>
          <dt>Wields</dt>
          <dd>
            {unit.weaponTypes.length > 0 ? unit.weaponTypes.map((type) => WEAPON_TYPE_LABELS[type]).join(', ') : '–'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// Each stat as a label, a bar filled toward its cap and "value/cap" (just
// the value, with a bar of its own length, when the class sets no cap).
function Stats({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="unit-info__column">
      <h3 className="unit-info__heading">Stats</h3>
      <dl className="unit-info__stats">
        {unit.stats.map((stat) => {
          const percent = stat.cap ? Math.min(100, (stat.value / stat.cap) * 100) : 100;
          const atCap = stat.cap !== null && stat.value >= stat.cap;
          return (
            <div key={stat.id} className={atCap ? 'unit-info__stat unit-info__stat--capped' : 'unit-info__stat'}>
              <dt>{stat.label}</dt>
              <span className="unit-info__stat-track" aria-hidden="true">
                <span className="unit-info__stat-fill" style={{ width: `${percent}%` }} />
              </span>
              <dd>
                {stat.value}
                {stat.cap !== null && <span className="unit-info__cap">/{stat.cap}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function Combat({ unit }: { unit: UnitDetailView }) {
  const weapon = unit.equippedWeapon;
  return (
    <div className="unit-info__column">
      <h3 className="unit-info__heading">Combat</h3>
      <dl className="unit-info__rates">
        <Rate label={unit.damageType === 'magical' ? 'Atk (mag)' : 'Atk'} value={unit.attack} />
        <Rate label="Hit" value={unit.hit} />
        <Rate label="Avoid" value={unit.avoid} />
        <Rate label="Crit" value={unit.crit} />
        <Rate label="AS" value={unit.attackSpeed} />
        <Rate label="RNG" value={unit.range} />
      </dl>

      <h3 className="unit-info__heading">Weapon</h3>
      {weapon ? (
        <p className="unit-info__weapon">
          <span className="unit-info__weapon-name">{weapon.label}</span>
          <span className="unit-info__weapon-numbers">
            <span>Mt {weapon.might}</span>
            <span>Hit {weapon.hit}</span>
            <span>Crit {weapon.crit}</span>
            <span>Wt {weapon.weight}</span>
            <span>Uses {weapon.uses === null ? '∞' : `${weapon.uses}/${weapon.maxUses}`}</span>
          </span>
        </p>
      ) : (
        <p className="unit-info__empty">None</p>
      )}

      <h3 className="unit-info__heading">Items</h3>
      {unit.items.length > 0 ? (
        <ul className="unit-info__list">
          {unit.items.map((item, index) => (
            <li key={`${item.id}@${index}`} className={item.equipped ? 'unit-info__item--equipped' : undefined}>
              <span>{item.label}</span>
              <span>{item.weapon ? (item.quantity ?? '∞') : `×${item.quantity}`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="unit-info__empty">None</p>
      )}

      <h3 className="unit-info__heading">Skills</h3>
      {unit.skills.length > 0 ? (
        <ul className="unit-info__list">
          {unit.skills.map((skill) => (
            <li key={skill.id}>
              <span>{skill.label}</span>
              <span>
                {skill.manaCost} MP, RNG {skill.range}
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

function Rate({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="unit-info__rate">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
