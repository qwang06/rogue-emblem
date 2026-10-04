// A battle's objective: what wins it and what loses it, shown on the
// Objective screen before the battle starts. Every map is a rout (defeat
// all enemies) unless it says otherwise; special maps can set their own
// objective once more kinds exist. The win/loss check itself lives in
// turns.ts (getBattleOutcome).

export type Objective = { kind: 'rout' };

// Defeat every enemy; lose if every player unit falls.
export const ROUT: Objective = Object.freeze({ kind: 'rout' });

// The objective of a level that doesn't set one.
export const DEFAULT_OBJECTIVE: Objective = ROUT;

export interface ObjectiveText {
  // What the player must do to win.
  goal: string;
  // What loses the battle.
  defeat: string;
}

// The objective as the words the Objective screen shows.
export function describeObjective(objective: Objective): ObjectiveText {
  switch (objective.kind) {
    case 'rout':
      return Object.freeze({ goal: 'Defeat all enemies', defeat: 'All your units fall' });
  }
}
