import { getUnitSprite } from '../game/tileset.ts';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// The level-up announcement, laid out like the GBA's: the unit's portrait
// (its map sprite, enlarged, until units have portraits) beside its name
// and new level, then each stat's new value in two columns with a "+N" on
// the ones that rose, and any skills it learned. GridScene decides when it
// shows and for how long.
export function LevelUpPanel() {
  const levelUp = useGameStore((state) => state.levelUp);
  if (!levelUp) return null;

  return (
    <div className="pause-overlay level-up-overlay">
      <section key={levelUp.id} className="panel level-up" role="alert">
        <h2 className="level-up__title">Level Up!</h2>
        <div className="level-up__header">
          <span className="level-up__portrait">
            <UnitSprite sprite={getUnitSprite(levelUp.unitClass)} scale={2} animated />
          </span>
          <p className="level-up__name">
            <span className="level-up__unit-name">{levelUp.name}</span>
            <span className="level-up__level">LV {levelUp.level}</span>
          </p>
        </div>
        <dl className="level-up__stats">
          {levelUp.stats.map((stat) => (
            <div key={stat.id} className={`level-up__stat${stat.gain > 0 ? ' level-up__stat--up' : ''}`}>
              <dt>{stat.label}</dt>
              <dd>
                {stat.value}
                <span className="level-up__gain">{stat.gain > 0 ? `+${stat.gain}` : ''}</span>
              </dd>
            </div>
          ))}
        </dl>
        {levelUp.skills.length > 0 && <p className="level-up__skills">Learned {levelUp.skills.join(', ')}</p>}
      </section>
    </div>
  );
}
