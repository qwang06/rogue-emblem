import type { RewardAction, TeamUnitView } from '../bridge/views.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { StatLabel } from './StatLabel.tsx';
import { UnitSprite } from './UnitSprite.tsx';

// The warband on the reward screen: each unit's sprite, level, XP and HP in
// a small tile, four to a row (two on a phone) so a full warband of eight stays
// short enough to keep the cards in view, and the player can tell who's
// hurt before picking. The class is in the tile's tooltip. While a reward that restores
// HP is selected, each row previews it as "12/20 ▸ 20/20", the HP it would
// add blinking on the bar. The "▸ 20/20" is always laid out (hidden when
// nothing is previewed), so moving the pick never reflows the rows. On a
// phone the preview takes the current HP's place, both laid out in one
// cell, and XP is left out, so a tile stays narrow enough for two to a
// row.
export function RewardTeam({ team, preview }: { team: readonly TeamUnitView[]; preview: RewardAction['healthAfter'] }) {
  return (
    <section className="panel reward-team" aria-label="Warband">
      <h3 className="reward-team__title">Warband</h3>
      <ul className="reward-team__units">
        {team.map((unit, index) => {
          const after = preview?.[index] ?? null;
          return <TeamRow key={unit.id} unit={unit} after={after} />;
        })}
      </ul>
    </section>
  );
}

function TeamRow({ unit, after }: { unit: TeamUnitView; after: { health: number; maxHealth: number } | null }) {
  const max = after?.maxHealth ?? unit.maxHealth;
  const kept = max > 0 ? (unit.health / max) * 100 : 0;
  const gained = after && max > 0 ? (Math.max(0, after.health - unit.health) / max) * 100 : 0;
  const changed = after !== null && (after.health !== unit.health || after.maxHealth !== unit.maxHealth);
  return (
    <li className="reward-team__unit" title={`${unit.name}, ${unit.unitClass}`}>
      <span className="reward-team__sprite" aria-hidden="true">
        <UnitSprite sprite={unit.sprite} />
      </span>
      <span className="reward-team__head">
        <span className="reward-team__name">{unit.name}</span>
        <span className="reward-team__level">
          Lv {unit.level}
          <span className="reward-team__exp">
            <GlyphIcon kind="exp" />
            <span className="visually-hidden">EXP </span>
            {unit.experienceForLevel === null ? '--' : unit.experience}
          </span>
        </span>
      </span>
      <span className="reward-team__label">
        <StatLabel label="HP" />
      </span>
      <span className={`reward-team__hp${after ? ' reward-team__hp--preview' : ''}`}>
        <span className="reward-team__hp-now">
          {unit.health}/{unit.maxHealth}
        </span>
        <span
          className={`reward-team__hp-after${changed ? ' reward-team__hp-after--up' : ''}`}
          style={after ? undefined : { visibility: 'hidden' }}
          aria-hidden={after ? undefined : 'true'}
        >
          {' ▸ '}
          {(after ?? unit).health}/{(after ?? unit).maxHealth}
        </span>
      </span>
      <span className="reward-team__bar" aria-hidden="true">
        <span className="reward-team__bar-kept" style={{ width: `${kept}%` }} />
        <span className="reward-team__bar-gained" style={{ width: `${gained}%` }} />
      </span>
    </li>
  );
}
