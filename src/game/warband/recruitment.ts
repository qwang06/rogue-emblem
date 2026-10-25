// A seeded guest joins selected battles. On a linear run, stage 2 always
// has one and later three-stage groups each contain one visit; on the
// realm (travel.ts), every village battle has one. The candidate is rolled
// before battle so reloading the same stage brings back the same person.
import { createSeededRng } from '../rng.ts';
import { getRunHeatRules } from './heat.ts';
import { MAX_ROSTER_SIZE, rollRecruit } from './rewards.ts';
import type { RunState, UnitSnapshot } from './run.ts';
import { getRunSite, isRealmRun } from './travel.ts';

export const GUEST_UNIT_ID = 'guest-recruit';

export function isRecruitmentStage(seed: number, stage: number): boolean {
  if (stage === 2) return true;
  if (stage < 3) return false;
  const group = Math.floor((stage - 3) / 3);
  const rng = createSeededRng((seed ^ Math.imul(group + 1, 0x9e3779b9) ^ 0x72656372) >>> 0);
  return stage === group * 3 + 3 + Math.floor(rng() * 3);
}

// Whether `run`'s current battle fields a guest: a village on the realm,
// else a recruitment stage (isRecruitmentStage). Never at a Heat that
// turns guests away (see heat.ts).
export function hasGuest(run: RunState): boolean {
  if (!getRunHeatRules(run).guests) return false;
  if (isRealmRun(run)) return getRunSite(run)?.kind === 'village';
  return isRecruitmentStage(run.seed, run.stage);
}

export function rollGuest(run: RunState): UnitSnapshot | null {
  if (!hasGuest(run) || run.roster.length >= MAX_ROSTER_SIZE) return null;
  const rng = createSeededRng((run.seed ^ Math.imul(run.stage, 0x85ebca6b) ^ 0x6a6f696e) >>> 0);
  return rollRecruit(run, run.stage, rng);
}

export function settleGuest(run: RunState, recruit: boolean): RunState {
  if (!run.pendingGuest) return run;
  const { pendingGuest, pendingRecruitment: _pending, ...rest } = run;
  return Object.freeze({ ...rest, roster: recruit ? Object.freeze([...run.roster, pendingGuest]) : run.roster });
}
