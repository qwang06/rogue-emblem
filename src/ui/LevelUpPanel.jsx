import { useGameStore } from './useGameStore.js';

// The level-up announcement: the unit's name and new level, each stat's new
// value with a "+N" highlight on the ones that rose, and any skills it
// learned. GridScene decides when it shows and for how long.
export function LevelUpPanel() {
  const levelUp = useGameStore((state) => state.levelUp);
  if (!levelUp) return null;

  return (
    <div className="pause-overlay level-up-overlay">
      <section key={levelUp.id} className="panel level-up" role="alert">
        <h2 className="level-up__title">Level Up!</h2>
        <p className="level-up__name">
          {levelUp.name} <span className="level-up__level">Lv {levelUp.level}</span>
        </p>
        <dl className="level-up__stats">
          {levelUp.stats.map((stat) => (
            <div key={stat.id} className={`level-up__stat${stat.gain > 0 ? ' level-up__stat--up' : ''}`}>
              <dt>{stat.label}</dt>
              <dd>
                {stat.value}
                {stat.gain > 0 && <span className="level-up__gain">+{stat.gain}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {levelUp.skills.length > 0 && <p className="level-up__skills">Learned {levelUp.skills.join(', ')}</p>}
      </section>
    </div>
  );
}
