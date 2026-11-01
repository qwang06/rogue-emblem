import type { UnitDetailView } from '../bridge/views.ts';
import { getExperienceForLevel } from '../game/experience.ts';
import { getRankLabel, RankBadge } from './RankBadge.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';
import { StatLabel } from './StatLabel.tsx';
import { Meter } from './UnitPanel.tsx';
import { UnitSprite } from './UnitSprite.tsx';

const WEAPON_TYPE_LABELS = { physical: 'Physical', magical: 'Magic', siege: 'Siege' } as const;

// The roster screen's pages for the picked unit, the way a tactics game's
// formation screen shows one. Stats: who it is (sprite, name, class,
// level, HP/MP/EXP, movement, what it wields) beside its stats and the
// rates it fights with. Skills: its skills beside its passives and quirk,
// each list scrolling in the page's fixed height, so paging down the
// roster never resizes the panel.
export function RosterStatsPage({ unit }: { unit: UnitDetailView | null }) {
  if (!unit) return <EmptySheet />;
  return (
    <section className="roster-sheet roster-sheet--stats" aria-label={`${unit.name}'s stats`}>
      <Identity unit={unit} />
      <Stats unit={unit} />
      <Combat unit={unit} />
    </section>
  );
}

export function RosterSkillsPage({ unit }: { unit: UnitDetailView | null }) {
  if (!unit) return <EmptySheet />;
  return (
    <section className="roster-sheet roster-sheet--skills" aria-label={`${unit.name}'s skills`}>
      <Skills unit={unit} />
      <Passives unit={unit} />
    </section>
  );
}

function EmptySheet() {
  return (
    <section className="roster-sheet roster-sheet--empty" aria-label="Unit">
      <p>Nobody on the roster.</p>
    </section>
  );
}

function Identity({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="roster-sheet__identity">
      <div className="roster-sheet__who">
        <span className="roster-sheet__portrait">
          <UnitSprite sprite={unit.sprite} scale={2} animated />
          {unit.rank && <RankBadge rank={unit.rank} scale={2} className="rank-badge--portrait" />}
        </span>
        <span className="roster-sheet__title">
          <span className="roster-sheet__name">{unit.name}</span>
          <span className="roster-sheet__class">
            {unit.classLabel ?? 'No class'}
            {unit.rank && ` · ${getRankLabel(unit.rank)}`}
          </span>
          <span className="roster-sheet__level">Lv {unit.level}</span>
        </span>
      </div>
      <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
      <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
      <Meter label="EXP" value={unit.experience} max={getExperienceForLevel(unit.level)} kind="exp" />
      <dl className="roster-sheet__pairs">
        <div>
          <dt>
            <StatLabel label="MOV" />
          </dt>
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

// Each stat as its abbreviation and value, one to a row like the rates.
function Stats({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="roster-sheet__box roster-sheet__stats">
      <h4 className="roster-sheet__heading">Stats</h4>
      <dl className="roster-sheet__stat-list">
        {unit.stats.map((stat) => (
          <div key={stat.id} className="roster-sheet__stat">
            <dt>
              <StatLabel label={stat.label} />
            </dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Combat({ unit }: { unit: UnitDetailView }) {
  const weapon = unit.equippedWeapon;
  return (
    <div className="roster-sheet__box roster-sheet__combat">
      <h4 className="roster-sheet__heading">Combat</h4>
      <dl className="roster-sheet__rates">
        <Rate label={unit.damageType === 'magical' ? 'Atk (mag)' : 'Atk'} icon="attack" value={unit.attack} />
        <Rate label="Hit" icon="hit" value={unit.hit} />
        <Rate label="Avoid" icon="avoid" value={unit.avoid} />
        <Rate label="Crit" icon="crit" value={unit.crit} />
        <Rate label="AS" value={unit.attackSpeed} />
        <Rate label="RNG" value={unit.range} />
      </dl>
      <p className="roster-sheet__weapon" title={weapon ? `${weapon.label}, range ${weapon.range}` : undefined}>
        <span className="roster-sheet__weapon-label">Weapon</span>
        <span className="roster-sheet__weapon-name">{weapon ? weapon.label : 'None'}</span>
      </p>
    </div>
  );
}

// A combat rate, its label led by the forecast's icon where it has one.
function Rate({ label, icon, value }: { label: string; icon?: StatIconKind; value: number | string }) {
  return (
    <div className="roster-sheet__rate">
      <dt>
        {icon ? <StatIcon kind={icon} /> : <span className="roster-sheet__no-icon" />}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function Skills({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="roster-sheet__box roster-sheet__skills">
      <h4 className="roster-sheet__heading">
        Skills{unit.secondaryClass && <span className="roster-sheet__secondary"> + {unit.secondaryClass} set</span>}
      </h4>
      {unit.skills.length > 0 ? (
        <ul className="roster-sheet__list">
          {unit.skills.map((skill) => (
            <li key={skill.id} className="roster-sheet__skill">
              <span className="roster-sheet__skill-name">{skill.label}</span>
              <span className="roster-sheet__skill-cost" title={`Costs ${skill.manaCost} MP, range ${skill.range}`}>
                {skill.manaCost} MP · Rng {skill.range}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="roster-sheet__none">None</p>
      )}
    </div>
  );
}

// Its class's passive, its passive boons and evolutions, then the quirk it
// joined with, each a name over what it does.
function Passives({ unit }: { unit: UnitDetailView }) {
  const entries = [
    ...unit.passives.map((passive) => ({ key: passive.id, ...passive, quirk: false })),
    ...(unit.quirk ? [{ key: 'quirk', ...unit.quirk, quirk: true }] : []),
  ];
  return (
    <div className="roster-sheet__box roster-sheet__passives">
      <h4 className="roster-sheet__heading">Passives</h4>
      {entries.length > 0 ? (
        <ul className="roster-sheet__list">
          {entries.map((entry) => (
            <li key={entry.key} className="roster-sheet__passive">
              <span className="roster-sheet__passive-name">
                {entry.label}
                {entry.quirk && <span className="roster-sheet__tag">Quirk</span>}
              </span>
              <span className="roster-sheet__passive-text">{entry.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="roster-sheet__none">None</p>
      )}
    </div>
  );
}
