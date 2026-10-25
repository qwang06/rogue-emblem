import { Frame } from './Frame.tsx';
import { useGameStore } from './useGameStore.ts';
import './Boss.css';

// The boss's name card as a boss stage opens: its name big, its title
// under it, and the two lines it greets the warband with, on a red banner
// mid-map. GridScene decides when it shows and for how long (confirm cuts
// it short); this draws it and fades it in and out over that duration.
export function BossIntro() {
  const intro = useGameStore((state) => state.bossIntro);
  if (!intro) return null;

  return (
    <Frame
      as="div"
      key={intro.id}
      variant="banner-red"
      className="boss-intro"
      style={{ animationDuration: `${intro.durationMs}ms` }}
      role="status"
    >
      <p className="boss-intro__name">
        {intro.name}
        {intro.title && <span className="boss-intro__title">{intro.title}</span>}
      </p>
      {intro.taunt.length > 0 && (
        <div className="boss-intro__taunt">
          {intro.taunt.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </Frame>
  );
}
