import { Frame } from './Frame.tsx';
import { useGameStore } from './useGameStore.ts';
import './Boss.css';

// The boss's HP bar while it lives in a boss battle: its name and title,
// a wide HP meter with the numbers, and tags for its rules' state (its
// horn has marked a tile, it has enraged). The tags keep their room when
// they're off, so the bar never changes size.
export function BossBar() {
  const bar = useGameStore((state) => state.bossBar);
  const decided = useGameStore((state) => state.battleOutcome !== null);
  if (!bar || decided) return null;
  const percent = bar.maxHealth > 0 ? (bar.health / bar.maxHealth) * 100 : 0;

  return (
    <Frame
      as="section"
      variant="banner-red"
      className={`boss-bar${bar.enraged ? ' boss-bar--enraged' : ''}`}
      aria-label="Boss"
    >
      <div className="boss-bar__head">
        <span className="boss-bar__name">{bar.name}</span>
        {bar.title && <span className="boss-bar__title">{bar.title}</span>}
        <span className="boss-bar__tags">
          <Tag on={bar.hornSounded} kind="horn" label="Horn" />
          <Tag on={bar.enraged} kind="enraged" label="Enraged" />
        </span>
      </div>
      <div className="meter meter--hp boss-bar__meter">
        <span className="meter__label">HP</span>
        <span className="meter__track">
          <span className="meter__fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="meter__value">
          {bar.health}/{bar.maxHealth}
        </span>
      </div>
    </Frame>
  );
}

// A state tag, laid out whether it's on or not.
function Tag({ on, kind, label }: { on: boolean; kind: string; label: string }) {
  return (
    <span className={`boss-bar__tag boss-bar__tag--${kind}${on ? '' : ' boss-bar__tag--off'}`} aria-hidden={!on}>
      {label}
    </span>
  );
}
