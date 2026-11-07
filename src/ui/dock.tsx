import type { ReactNode } from 'react';
import type { GameState } from '../bridge/gameStore.ts';

// Whether the battle map is what the player is looking at: a battle (or its
// deployment) is running and no between-stage screen (camp, rewards, a run's
// recap) covers it. The battle frame (the columns, the bar, the board's
// frame) shows only then.
export function isOnField(state: GameState): boolean {
  return (
    state.screen === 'battle' &&
    state.phase !== null &&
    state.battleOutcome === null &&
    !state.campMenu &&
    !state.rewardMenu &&
    !state.boonPick &&
    !state.rosterScreen &&
    !state.equipmentScreen &&
    !state.merchantScreen &&
    !state.promotionScreen &&
    !state.mentorScreen &&
    !state.runSummary &&
    !state.stageClear
  );
}

// One readout of a column: a small caps heading on a hairline, then its
// contents.
export function DockSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `dock-section ${className}` : 'dock-section'}>
      <h2 className="dock-section__title">{title}</h2>
      {children}
    </section>
  );
}
