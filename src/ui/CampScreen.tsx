import { BOON_ICON_URLS } from '../assets/boonIcons.ts';
import type { CampView } from '../bridge/campView.ts';
import { gameCommands } from '../bridge/commands.ts';
import type { UnitDetailView } from '../bridge/views.ts';
import type { CampActionId } from '../game/warband/camp.ts';
import type { Menu } from '../game/actionMenu.ts';
import { WEAPON_TYPE_LABELS } from '../game/weapons.ts';
import { DockSection } from './dock.tsx';
import { GlyphIcon } from './GlyphIcon.tsx';
import { ItemIcon } from './ItemIcon.tsx';
import { KeyHint, type KeyHintEntry } from './KeyHint.tsx';
import { MenuIcon } from './MenuIcon.tsx';
import { menuItemPointerProps } from './menuPointer.ts';
import { Pips } from './Pips.tsx';
import { RelicIcon } from './RelicIcon.tsx';
import { StatLabel } from './StatLabel.tsx';
import { Meter } from './UnitPanel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import './UnitInfoScreen.css';
import './CampScreen.css';

// The camp between Warband Mode stages, once the reward is taken (see
// src/game/warband/camp.ts), as one screen over the stage: the warband
// down the left (each unit's row with its HP as blocks, flagged when hurt
// or ready to promote; the picked one lit) with the supplies under it;
// the picked unit's dossier in the middle (portrait, name, class and
// quirk, what it's trained in, its level and the XP to the next, its
// meters, stats with their growths and the rates it fights with, beside
// what it wears and its skills); and the camp's actions down the right
// as a stack of keyed rows (Manage Roster opens the roster screen,
// Equipment the equipment screen, Merchant the merchant, Promote the
// promotion screen, Rest heals everyone for gold, Mentors the mentor
// screen, Next Stage / Travel marches on), each with a note on what it
// offers now, the relics under them and where the warband stands at the
// foot. The bar carries the keys and a button for marching on. It hides
// while one of those screens is open. GridScene handles the input (up
// and down move the action, left and right the unit, digits pick an
// action); the mouse is forwarded to it.
export function CampScreen() {
  const menu = useGameStore((state) => state.campMenu);
  const camp = useGameStore((state) => state.camp);
  const screenOpen = useGameStore(
    (state) =>
      state.rosterScreen !== null ||
      state.merchantScreen !== null ||
      state.equipmentScreen !== null ||
      state.promotionScreen !== null ||
      state.mentorScreen !== null,
  );
  if (!menu || !camp || screenOpen) return null;

  const marchIndex = menu.actions.findIndex((action) => action.id === 'march');
  const march = marchIndex >= 0 ? menu.actions[marchIndex] : null;
  return (
    <div className="camp-screen" role="dialog" aria-label="Camp">
      <aside className="camp-screen__column camp-screen__warband">
        <Warband camp={camp} />
        <Supplies camp={camp} />
      </aside>
      <section className="camp-screen__dossier" aria-label={camp.unit ? `${camp.unit.name}'s sheet` : 'No unit'}>
        {camp.unit ? <Dossier unit={camp.unit} experienceToNext={camp.experienceToNext} /> : null}
      </section>
      <aside className="camp-screen__column camp-screen__side">
        <Actions menu={menu} camp={camp} />
        <Relics camp={camp} />
        <Here camp={camp} />
      </aside>
      <footer className="camp-screen__bar">
        <KeyHint className="camp-screen__hints" entries={HINTS} />
        {march && (
          <button
            type="button"
            className="battle-bar__button battle-bar__button--end"
            onClick={() => gameCommands.send({ type: 'select-menu', menu: 'campMenu', index: marchIndex })}
          >
            <MenuIcon id="march" />
            {march.label}
          </button>
        )}
      </footer>
    </div>
  );
}

const HINTS: readonly KeyHintEntry[] = [
  ['↑↓', 'Action'],
  ['←→', 'Unit'],
  ['1–9', 'Pick'],
  ['Enter', 'Confirm'],
];

// Every unit on the roster, the picked one lit; a click picks it.
function Warband({ camp }: { camp: CampView }) {
  return (
    <DockSection title="Warband" className="camp-screen__roster">
      <ul className="camp-screen__units">
        {camp.units.map((unit, index) => {
          const classes = ['camp-screen__unit'];
          if (index === camp.unitIndex) classes.push('camp-screen__unit--picked');
          return (
            <li
              key={unit.id}
              className={classes.join(' ')}
              aria-current={index === camp.unitIndex ? 'true' : undefined}
              onClick={() => gameCommands.send({ type: 'pick-camp-unit', index })}
            >
              <span className="camp-screen__unit-sprite">
                <UnitSprite sprite={unit.sprite} />
              </span>
              <span className="camp-screen__unit-name" title={unit.name}>
                {unit.name}
              </span>
              <span className="camp-screen__unit-hp">
                {unit.health}
                {unit.hurt && <span className="camp-screen__unit-hp-max">/{unit.maxHealth}</span>}
              </span>
              <span className="camp-screen__unit-class" title={unit.classLabel}>
                {unit.classLabel} · Lv {unit.level}
                {unit.hurt && <span className="camp-screen__unit-flag camp-screen__unit-flag--hurt"> · Hurt</span>}
                {unit.promotable && <span className="camp-screen__unit-flag"> · Promote</span>}
              </span>
              <span className="camp-screen__unit-pips">
                <Pips value={unit.health} max={unit.maxHealth} size="small" />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="camp-screen__count">
        <span className="camp-screen__count-number">{camp.units.length}</span>{' '}
        {camp.units.length === 1 ? 'unit' : 'units'}
      </p>
    </DockSection>
  );
}

// The gold and the convoy's potions, with how much the convoy holds.
function Supplies({ camp }: { camp: CampView }) {
  return (
    <DockSection title="Supplies" className="camp-screen__supplies">
      <p className="camp-screen__supply-row">
        <span className="camp-screen__supply" title={`${camp.gold} gold`}>
          <GlyphIcon kind="gold" />
          {camp.gold}
        </span>
        {camp.supplies.map((item) => (
          <span key={item.id} className="camp-screen__supply" title={item.label}>
            <ItemIcon itemId={item.id} />
            {item.quantity}
          </span>
        ))}
      </p>
      <p className="camp-screen__convoy">
        Convoy · {camp.convoyCount} {camp.convoyCount === 1 ? 'item' : 'items'}
      </p>
    </DockSection>
  );
}

// The camp's actions as a stack of keyed rows, the highlighted one lit,
// each with a note on what it offers now.
function Actions({ menu, camp }: { menu: Menu; camp: CampView }) {
  return (
    <DockSection title="Camp" className="camp-screen__actions">
      <ul className="camp-screen__action-list" aria-label="Camp actions">
        {menu.actions.map((action, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['camp-screen__action'];
          if (selected) classes.push('camp-screen__action--selected');
          if (action.disabled) classes.push('camp-screen__action--disabled');
          return (
            <li
              key={action.id}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              aria-disabled={action.disabled ? 'true' : undefined}
              {...menuItemPointerProps('campMenu', index)}
            >
              {index < 9 && <kbd className="camp-screen__key">{index + 1}</kbd>}
              <MenuIcon id={action.id} />
              <span className="camp-screen__action-label">{action.label}</span>
              <span className="camp-screen__action-note">{camp.notes[action.id as CampActionId] ?? ''}</span>
            </li>
          );
        })}
      </ul>
    </DockSection>
  );
}

function Relics({ camp }: { camp: CampView }) {
  if (camp.relics.length === 0) return null;
  return (
    <DockSection title="Relics" className="camp-screen__relics">
      <ul className="camp-screen__relic-list">
        {camp.relics.map((relic) => (
          <li key={relic.id} className="camp-screen__relic">
            <RelicIcon id={relic.id} keystoneId={relic.keystoneId} className="camp-screen__relic-icon" />
            <span className="camp-screen__relic-name">
              {relic.name}
              {relic.copies > 1 && <span className="camp-screen__relic-copies"> ×{relic.copies}</span>}
            </span>
            <span className="camp-screen__relic-text">{relic.description}</span>
          </li>
        ))}
      </ul>
    </DockSection>
  );
}

// Where the warband stands: its site on the realm, else the stage ahead.
function Here({ camp }: { camp: CampView }) {
  const stage = camp.finalStage ? `Stage ${camp.stage} of ${camp.finalStage}` : `Stage ${camp.stage}`;
  return (
    <DockSection title="Here" className="camp-screen__here">
      <p className="camp-screen__here-name">{camp.site?.name ?? 'The road'}</p>
      <p className="camp-screen__here-line">
        {[camp.site?.kindLabel, camp.site?.region, stage].filter(Boolean).join(' · ')}
      </p>
    </DockSection>
  );
}

// The picked unit's sheet, the way a tactics game's camp shows one.
function Dossier({ unit, experienceToNext }: { unit: UnitDetailView; experienceToNext: number }) {
  const trained = unit.weaponTypes.map((type) => WEAPON_TYPE_LABELS[type]);
  const over = Math.max(0, unit.load.weight - unit.load.strength);
  return (
    <>
      <header className="camp-screen__head">
        <span className="camp-screen__portrait">
          <UnitSprite sprite={unit.sprite} scale={3} animated />
        </span>
        <div className="camp-screen__lines">
          <h2 className="camp-screen__name" title={unit.name}>
            {unit.name}
          </h2>
          <p className="camp-screen__class">
            {unit.classLabel ?? 'No class'}
            {unit.quirk && ` · ${unit.quirk.label}`}
          </p>
          <p className="camp-screen__tags">
            {trained.map((type) => (
              <span key={type} className="camp-screen__tag">
                {type}
              </span>
            ))}
            {unit.promotions.length > 0 && (
              <span className="camp-screen__tag camp-screen__tag--hot">Promotes at LV {unit.promotionLevel}</span>
            )}
          </p>
        </div>
        <div className="camp-screen__level">
          <span className="camp-screen__level-label">Level</span>
          <span className="camp-screen__level-value">{unit.level}</span>
          <span className="camp-screen__level-next">{experienceToNext} exp to next</span>
        </div>
      </header>

      <div className="camp-screen__pages">
        <div className="camp-screen__page">
          <div className="camp-screen__meters">
            <Meter label="HP" value={unit.health} max={unit.maxHealth} kind="hp" />
            <Meter label="MP" value={unit.mana} max={unit.maxMana} kind="mp" />
          </div>

          <h3 className="unit-info__heading">
            <span>Stats</span>
            <span className="unit-info__heading-note">growth</span>
          </h3>
          <dl className="camp-screen__grid">
            {unit.stats.map((stat) => (
              <div key={stat.id} className="camp-screen__cell">
                <dt>
                  <StatLabel label={stat.label} />
                </dt>
                <dd>
                  {stat.value}
                  <span className={growthClass(stat.growth)}>{stat.growth}%</span>
                </dd>
              </div>
            ))}
            <div className="camp-screen__cell">
              <dt>
                <StatLabel label="MOV" />
              </dt>
              <dd>{unit.movement}</dd>
            </div>
            <div className="camp-screen__cell">
              <dt>
                <StatLabel label="RNG" />
              </dt>
              <dd>{unit.range}</dd>
            </div>
          </dl>

          {unit.quirk && (
            <>
              <h3 className="unit-info__heading">
                <span>Quirk</span>
              </h3>
              <p className="camp-screen__quirk">
                <span className="camp-screen__quirk-name">{unit.quirk.label}</span> · {unit.quirk.description}
              </p>
            </>
          )}

          <h3 className="unit-info__heading">
            <span>Combat</span>
            <span className="unit-info__heading-note">{unit.equippedWeapon?.label ?? 'bare-handed'}</span>
          </h3>
          <dl className="camp-screen__grid">
            <Rate label={unit.damageType === 'magical' ? 'Atk (mag)' : 'Atk'} value={unit.attack} />
            <Rate label="Hit" value={unit.hit} />
            <Rate label="Avo" value={unit.avoid} />
            <Rate label="Crt" value={unit.crit} />
            <Rate label="AS" value={unit.attackSpeed} />
            <div className={over > 0 ? 'camp-screen__cell camp-screen__cell--over' : 'camp-screen__cell'}>
              <dt>Load</dt>
              <dd>
                {unit.load.weight}
                <span className="camp-screen__cell-max">/{unit.load.strength}</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="camp-screen__page">
          <h3 className="unit-info__heading">
            <span>Equipment</span>
          </h3>
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

          <h3 className="unit-info__heading">
            <span>Skills</span>
            {unit.secondaryClass && <span className="unit-info__heading-note">+ {unit.secondaryClass} set</span>}
          </h3>
          {unit.skills.length + unit.passives.length > 0 ? (
            <ul className="unit-info__entries">
              {unit.skills.map((skill) => (
                <li key={skill.id} className="unit-info__entry camp-screen__entry" title={skill.description}>
                  <EntryIcon url={BOON_ICON_URLS[`skill-${skill.id}`]} />
                  <span className="unit-info__serif">{skill.label}</span>
                  <span className="unit-info__entry-note unit-info__entry-note--cost">{skill.manaCost} MP</span>
                </li>
              ))}
              {unit.passives.map((passive) => (
                <li key={passive.id} className="unit-info__entry camp-screen__entry" title={passive.description}>
                  <EntryIcon url={BOON_ICON_URLS[passive.id]} />
                  <span className="unit-info__serif">{passive.label}</span>
                  <span className="unit-info__entry-note unit-info__entry-note--passive">Passive</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="unit-info__empty">None</p>
          )}

          <h3 className="unit-info__heading">
            <span>Items</span>
            <span className="unit-info__heading-note">
              {unit.bag.length} of {unit.bagSlots}
            </span>
          </h3>
          {unit.bag.length > 0 ? (
            <ul className="unit-info__entries">
              {unit.bag.map((item, index) => (
                <li
                  key={`${item.id}@${index}`}
                  className="unit-info__entry camp-screen__entry"
                  title={item.description}
                >
                  <ItemIcon itemId={item.id} />
                  <span className="unit-info__serif">{item.label}</span>
                  <span className="unit-info__entry-note">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="unit-info__empty">None</p>
          )}
        </div>
      </div>
    </>
  );
}

function Rate({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="camp-screen__cell">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function growthClass(growth: number): string {
  if (growth >= 50) return 'camp-screen__growth camp-screen__growth--high';
  if (growth <= 15) return 'camp-screen__growth camp-screen__growth--low';
  return 'camp-screen__growth';
}

function EntryIcon({ url }: { url: string | undefined }) {
  return url ? (
    <img className="unit-info__entry-icon" src={url} alt="" width={24} height={24} />
  ) : (
    <span className="unit-info__entry-icon unit-info__entry-icon--missing" />
  );
}
