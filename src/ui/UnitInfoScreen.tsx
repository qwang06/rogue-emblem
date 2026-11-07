import { BOON_ICON_URLS } from '../assets/boonIcons.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { UnitDetailView } from '../bridge/views.ts';
import { getExperienceForLevel } from '../game/experience.ts';
import { WEAPON_TYPE_LABELS } from '../game/weapons.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { MenuExitButton } from './MenuExitButton.tsx';
import { getRankLabel, RankBadge } from './RankBadge.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';
import { StatLabel } from './StatLabel.tsx';
import { Meter } from './UnitPanel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './UnitInfoScreen.css';

// The unit info screen: the full sheet for the unit the cursor was on
// when I was pressed, laid out as a dossier in three columns over the
// stage (an ink window on narrow windows, where the columns stack). On
// the left, who it is: a framed portrait beside its name in the serif,
// its class and its level as the one big number, the weapon types it's
// trained in, then HP, MP and (for player units) EXP bars, its quirk, and
// the classes it can promote to. In the middle, each stat as a bar (HP
// against its maximum, the rest against its highest stat, so the bars
// show the build's shape) with its value and the percent of a point it
// gains a level, MOV under them, then what it carries against its
// strength. On the right, the rates it fights with as six tiles (the
// attack it leads with lit), every attack it can make with its numbers
// (a monster's special attack among them), then what it wears in each
// gear slot with its passives under it, beside its skills (each with its
// icon, cost and a line on what it does) and the potions in its bag with
// the empty slots left. Stats are labelled with their abbreviation
// (StatLabel). The hover UnitPanel stays the quick view. GridScene
// handles the input (I, a right click on a unit, or a left click on one
// the player can't command opens it; I, confirm or cancel closes it), and
// a click anywhere closes it too.
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
        </section>
        <MenuExitButton kind="close" />
      </div>
    </div>
  );
}

// A section's caps heading on a hairline, with a dim note at its end.
function Heading({ children, note }: { children: string; note?: string }) {
  return (
    <h3 className="unit-info__heading">
      <span>{children}</span>
      {note && <span className="unit-info__heading-note">{note}</span>}
    </h3>
  );
}

function Identity({ unit }: { unit: UnitDetailView }) {
  const trained = unit.weaponTypes.map((type) => WEAPON_TYPE_LABELS[type]).join(' · ');
  return (
    <div className="unit-info__column unit-info__identity">
      <div className="unit-info__head">
        <span className="unit-info__portrait">
          <UnitSprite sprite={unit.sprite} scale={3} animated />
          {unit.rank && <RankBadge rank={unit.rank} scale={2} className="rank-badge--portrait" />}
        </span>
        <div className="unit-info__lines">
          <h2 className="unit-info__name" id="unit-info-name" title={unit.name}>
            {unit.name}
          </h2>
          <p className="unit-info__class">
            {unit.classLabel ?? 'No class'}
            {unit.rank && <span className="unit-info__rank"> · {getRankLabel(unit.rank)}</span>}
          </p>
          <p className="unit-info__level">
            <span className="unit-info__level-label">Level</span>
            <span className="unit-info__level-value">{unit.level}</span>
          </p>
          <p className="unit-info__trained">{trained ? `Trained · ${trained}` : 'Untrained'}</p>
        </div>
      </div>
      <div className="unit-info__meters">
        <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
        <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
        {unit.team !== 'enemy' && (
          <Meter label="EXP" value={unit.experience} max={getExperienceForLevel(unit.level)} kind="exp" />
        )}
      </div>

      <Heading>Quirk</Heading>
      {unit.quirk ? (
        <div className="unit-info__quirk">
          <p className="unit-info__quirk-name">{unit.quirk.label}</p>
          <p className="unit-info__quirk-text">{unit.quirk.description}</p>
        </div>
      ) : (
        <p className="unit-info__empty">None</p>
      )}

      {unit.promotions.length > 0 && (
        <>
          <Heading note={`at LV ${unit.promotionLevel}`}>Promotion</Heading>
          <ul className="unit-info__promotions">
            {unit.promotions.map((path) => (
              <li key={path.id} className="unit-info__promotion">
                <span className="unit-info__promotion-sprite">
                  <UnitSprite sprite={path.sprite} />
                </span>
                <span className="unit-info__promotion-name">{path.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Growths worth noting: a stat that grows at least half a point a level
// reads green, one that hardly grows reads faint.
function growthClass(growth: number | null): string {
  if (growth === null) return 'unit-info__growth unit-info__growth--none';
  if (growth >= 50) return 'unit-info__growth unit-info__growth--high';
  if (growth <= 15) return 'unit-info__growth unit-info__growth--low';
  return 'unit-info__growth';
}

function StatRow({
  label,
  value,
  percent,
  growth,
  kind,
}: {
  label: string;
  value: number;
  percent: number;
  growth: number | null;
  kind?: 'hp';
}) {
  return (
    <div className="unit-info__stat">
      <dt>
        <StatLabel label={label} />
      </dt>
      <span className="unit-info__stat-track" aria-hidden="true">
        <span
          className={kind ? `unit-info__stat-fill unit-info__stat-fill--${kind}` : 'unit-info__stat-fill'}
          style={{ width: `${percent}%` }}
        />
      </span>
      <dd>{value}</dd>
      <span className={growthClass(growth)}>{growth === null ? '—' : `${growth}%`}</span>
    </div>
  );
}

// Each stat as a label, a bar, its value and its growth: HP's bar is its
// health against its maximum, the others are sized against the unit's
// highest stat (stats have no caps). Then what it carries.
function Stats({ unit }: { unit: UnitDetailView }) {
  const highest = Math.max(1, ...unit.stats.map((stat) => stat.value));
  const over = Math.max(0, unit.load.weight - unit.load.strength);
  const carry =
    over === 0
      ? 'Within strength · no penalty'
      : `${over} over strength · −${over} AS${unit.load.movementPenalty > 0 ? ` · −${unit.load.movementPenalty} MOV` : ''}`;
  return (
    <div className="unit-info__column unit-info__stats-column">
      <Heading note="right: growth per level">Stats</Heading>
      <dl className="unit-info__stats">
        <StatRow
          label="HP"
          value={unit.maxHealth}
          percent={(unit.health / Math.max(1, unit.maxHealth)) * 100}
          growth={unit.healthGrowth}
          kind="hp"
        />
        {unit.stats.map((stat) => (
          <StatRow
            key={stat.id}
            label={stat.label}
            value={stat.value}
            percent={(Math.max(0, stat.value) / highest) * 100}
            growth={stat.growth}
          />
        ))}
        <StatRow label="MOV" value={unit.movement} percent={0} growth={null} />
      </dl>

      <Heading note="load">Carry</Heading>
      <div className="unit-info__carry">
        <span className="unit-info__carry-track" aria-hidden="true">
          <span
            className={over > 0 ? 'unit-info__carry-fill unit-info__carry-fill--over' : 'unit-info__carry-fill'}
            style={{ width: `${Math.min(100, (unit.load.weight / Math.max(1, unit.load.strength)) * 100)}%` }}
          />
        </span>
        <span className="unit-info__carry-value">
          {unit.load.weight}
          <span className="unit-info__carry-max">/{unit.load.strength}</span>
        </span>
      </div>
      <p className="unit-info__carry-note">{carry}</p>
    </div>
  );
}

function Combat({ unit }: { unit: UnitDetailView }) {
  return (
    <div className="unit-info__column unit-info__combat">
      <Heading note={unit.equippedWeapon ? `with ${unit.equippedWeapon.label}` : 'bare-handed'}>Combat</Heading>
      <dl className="unit-info__tiles">
        <Tile label={unit.damageType === 'magical' ? 'Atk (mag)' : 'Atk'} icon="attack" value={unit.attack} lit />
        <Tile label="Hit" icon="hit" value={unit.hit} />
        <Tile label="Avo" icon="avoid" value={unit.avoid} />
        <Tile label="Crt" icon="crit" value={unit.crit} />
        <Tile label="AS" value={unit.attackSpeed} />
        <Tile label="Rng" value={unit.range} />
      </dl>

      <Attacks unit={unit} />

      <div className="unit-info__two">
        <div>
          <Equipment unit={unit} />
          <Passives unit={unit} />
        </div>
        <div>
          <Skills unit={unit} />
          <Bag unit={unit} />
        </div>
      </div>
    </div>
  );
}

// A combat rate as a tile: its caps label (led by the forecast's icon
// where it has one) over the number; the one lit is what it leads with.
function Tile({
  label,
  icon,
  value,
  lit = false,
}: {
  label: string;
  icon?: StatIconKind;
  value: number | string;
  lit?: boolean;
}) {
  return (
    <div className={lit ? 'unit-info__tile unit-info__tile--lit' : 'unit-info__tile'}>
      <dt>
        {icon && <StatIcon kind={icon} />}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

// Every attack it can make, the one it fights with lit: the weapon in its
// main hand, then its innate ones (a monster's special attack, fists,
// spells it knows), each with its numbers at the row's end.
function Attacks({ unit }: { unit: UnitDetailView }) {
  return (
    <>
      <Heading>Attacks</Heading>
      {unit.attacks.length > 0 ? (
        <ul className="unit-info__attacks">
          {unit.attacks.map((attack) => (
            <li
              key={`${attack.id}@${attack.innate}`}
              className={attack.equipped ? 'unit-info__attack unit-info__attack--equipped' : 'unit-info__attack'}
            >
              <ItemIcon itemId={attack.id} />
              <span className="unit-info__attack-name">
                <span className="unit-info__serif">{attack.label}</span>
                <span className="unit-info__tag">{attack.innate ? 'Natural' : WEAPON_TYPE_LABELS[attack.type]}</span>
              </span>
              <dl className="unit-info__numbers">
                <Number label="Pow" value={attack.power} />
                <Number label="Hit" value={attack.hit} />
                <Number label="Crt" value={attack.crit} />
                <Number label="Wt" value={attack.weight} />
                <Number label="Rng" value={attack.range} />
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="unit-info__empty">None</p>
      )}
    </>
  );
}

// What it wears in each of its slots (a humanoid's main hand, off hand,
// head, body and accessory; a monster's special and accessory), an empty
// slot marked so, a piece that bends a rule with that as its tooltip.
function Equipment({ unit }: { unit: UnitDetailView }) {
  return (
    <>
      <Heading>Equipment</Heading>
      <ul className="unit-info__slots">
        {unit.equipment.map(({ slot, label, gear }) => (
          <li key={slot} className="unit-info__slot" title={gear?.description ?? undefined}>
            <span className="unit-info__slot-label">{label}</span>
            {gear ? (
              <>
                <ItemIcon itemId={gear.id} />
                <span className="unit-info__serif unit-info__slot-name">{gear.label}</span>
              </>
            ) : (
              <>
                <span className="unit-info__placeholder" />
                <span className="unit-info__slot-name unit-info__slot-name--empty">— empty</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// Its passives (a promoted class's, boons, an elite's affix, a boss's
// rules), each with its icon where it has one.
function Passives({ unit }: { unit: UnitDetailView }) {
  if (unit.passives.length === 0) return null;
  return (
    <>
      <Heading>Passives</Heading>
      <ul className="unit-info__entries">
        {unit.passives.map((passive) => (
          <li key={passive.id} className="unit-info__entry">
            <EntryIcon url={BOON_ICON_URLS[passive.id]} />
            <span className="unit-info__entry-text">
              <span className="unit-info__serif">{passive.label}</span>
              <span className="unit-info__entry-line">{passive.description}</span>
            </span>
            <span className="unit-info__entry-note unit-info__entry-note--passive">Passive</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Skills({ unit }: { unit: UnitDetailView }) {
  return (
    <>
      <Heading note={unit.secondaryClass ? `+ ${unit.secondaryClass} set` : undefined}>Skills</Heading>
      {unit.skills.length > 0 ? (
        <ul className="unit-info__entries">
          {unit.skills.map((skill) => (
            <li key={skill.id} className="unit-info__entry">
              <EntryIcon url={BOON_ICON_URLS[`skill-${skill.id}`]} />
              <span className="unit-info__entry-text">
                <span className="unit-info__serif">{skill.label}</span>
                <span className="unit-info__entry-line">{skill.description}</span>
              </span>
              <span className="unit-info__entry-note unit-info__entry-note--cost" title={`Range ${skill.range}`}>
                {skill.manaCost} MP
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="unit-info__empty">None</p>
      )}
    </>
  );
}

// The potions in its bag, then the slots still free.
function Bag({ unit }: { unit: UnitDetailView }) {
  const free = Math.max(0, unit.bagSlots - unit.bag.length);
  return (
    <>
      <Heading note={`${unit.bag.length} of ${unit.bagSlots}`}>Items</Heading>
      <ul className="unit-info__entries">
        {unit.bag.map((item, index) => (
          <li key={`${item.id}@${index}`} className="unit-info__entry">
            <ItemIcon itemId={item.id} />
            <span className="unit-info__entry-text">
              <span className="unit-info__serif">{item.label}</span>
              <span className="unit-info__entry-line">{item.description}</span>
            </span>
            <span className="unit-info__entry-note">×{item.quantity}</span>
          </li>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <li key={`free-${i}`} className="unit-info__entry unit-info__entry--empty" aria-hidden="true">
            <span className="unit-info__placeholder" />
            <span className="unit-info__entry-text">
              <span className="unit-info__slot-name--empty">— empty</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

// A skill's or a passive's icon (the boon sheet's, see boonIcons.ts), or
// the spot kept for one.
function EntryIcon({ url }: { url: string | undefined }) {
  return url ? (
    <img className="unit-info__entry-icon" src={url} alt="" width={24} height={24} />
  ) : (
    <span className="unit-info__entry-icon unit-info__entry-icon--missing" />
  );
}

// One of an attack's numbers: "POW 1", as the command bar's chips read.
function Number({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="unit-info__number">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
