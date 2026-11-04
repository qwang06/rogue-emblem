import type { RewardAction, TeamUnitView } from '../bridge/views.ts';
import { UnitSprite } from './UnitSprite.tsx';

// The warband on the reward screen as a strip of small tiles, one row of up
// to eight (four to a row on a phone): each unit's sprite, name, level and
// HP bar, so the player can tell who's hurt before picking without the
// strip taking much of the screen. Exact HP, XP and the class are in the
// tile's tooltip. While a reward that restores HP is selected, each bar
// blinks the HP it would add. Nothing in a tile changes size with the
// preview, so moving the pick never reflows the strip.
export function RewardTeam({ team, preview }: { team: readonly TeamUnitView[]; preview: RewardAction['healthAfter'] }) {
  return (
    <ul className="reward-team" aria-label="Warband">
      {team.map((unit, index) => (
        <TeamTile key={unit.id} unit={unit} after={preview?.[index] ?? null} />
      ))}
    </ul>
  );
}

function TeamTile({ unit, after }: { unit: TeamUnitView; after: { health: number; maxHealth: number } | null }) {
  const max = after?.maxHealth ?? unit.maxHealth;
  const kept = max > 0 ? (unit.health / max) * 100 : 0;
  const gained = after && max > 0 ? (Math.max(0, after.health - unit.health) / max) * 100 : 0;
  const hp = `HP ${unit.health}/${unit.maxHealth}`;
  const healed = after && gained > 0 ? `, ${after.health}/${after.maxHealth} after` : '';
  return (
    <li
      className="reward-team__unit"
      title={`${unit.name}, ${unit.unitClass}\nLv ${unit.level} · ${unit.experience}/${unit.experienceForLevel} XP\n${hp}`}
    >
      <span className="reward-team__sprite" aria-hidden="true">
        <UnitSprite sprite={unit.sprite} />
      </span>
      <span className="reward-team__head">
        <span className="reward-team__name">{unit.name}</span>
        <span className="reward-team__level">
          <span className="visually-hidden">Level </span>
          {unit.level}
        </span>
      </span>
      <span className="reward-team__bar" aria-hidden="true">
        <span className="reward-team__bar-kept" style={{ width: `${kept}%` }} />
        <span className="reward-team__bar-gained" style={{ width: `${gained}%` }} />
      </span>
      <span className="visually-hidden">
        {hp}
        {healed}
      </span>
    </li>
  );
}
