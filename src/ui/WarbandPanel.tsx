import type { TeamUnitView } from '../bridge/views.ts';
import { UnitSprite } from './UnitSprite.tsx';

// The warband on the overworld, in its own window rather than the page's
// header: each unit's sprite with its level and an HP bar, four to a row
// (all eight in one row on a phone, without the level), its name, class
// and HP in the tooltip. Every tile is the same size, so a full warband of
// eight takes the same room as any other.
export function WarbandPanel({ team }: { team: readonly TeamUnitView[] }) {
  return (
    <section className="panel warband-panel" aria-label="Warband">
      <h3 className="warband-panel__title">Warband</h3>
      <ul className="warband-panel__units">
        {team.map((unit) => {
          const percent = unit.maxHealth > 0 ? (unit.health / unit.maxHealth) * 100 : 0;
          const summary = `${unit.name}, ${unit.unitClass} · Lv ${unit.level} · ${unit.health}/${unit.maxHealth} HP`;
          return (
            <li key={unit.id} className="warband-panel__unit" title={summary}>
              <span className="visually-hidden">{summary}</span>
              <span className="warband-panel__sprite" aria-hidden="true">
                <UnitSprite sprite={unit.sprite} />
              </span>
              <span className="warband-panel__level" aria-hidden="true">
                Lv {unit.level}
              </span>
              <span className="warband-panel__bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
