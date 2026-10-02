import { useGameStore } from './useGameStore.js';

// The XP bar that fills after a player unit's combat: its name and level,
// "+N EXP", and a bar animating from the old XP to the new (to full on a
// level up, where the level-up panel takes over). GridScene decides when
// it shows and for how long; this draws it and plays the fill.
export function ExperienceBar() {
  const gain = useGameStore((state) => state.experienceGain);
  if (!gain) return null;

  const style = {
    '--xp-from': `${gain.startPercent}%`,
    '--xp-to': `${gain.endPercent}%`,
    '--xp-duration': `${gain.durationMs}ms`,
  };
  return (
    <section key={gain.id} className="panel experience-bar" role="status" aria-label="Experience" style={style}>
      <div className="experience-bar__header">
        <span className="experience-bar__name">{gain.name}</span>
        <span className="experience-bar__level">Lv {gain.level}</span>
        <span className="experience-bar__gain">+{gain.gained} EXP</span>
      </div>
      <div className="experience-bar__track">
        <span className="experience-bar__fill" />
      </div>
    </section>
  );
}
