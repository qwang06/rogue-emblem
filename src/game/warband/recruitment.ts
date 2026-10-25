// Recruiting in Warband Mode, two ways:
// - A seeded guest joins selected battles. On a linear run, stage 2 always
//   has one and later three-stage groups each contain one visit; on the
//   realm (travel.ts), every village battle has one. The candidate is
//   rolled before battle so reloading the same stage brings back the same
//   person.
// - A Recruit reward (rewards.ts) opens a draft, Slay the Spire style: a
//   pick of DRAFT_CHOICES recruits of different classes, each with its own
//   quirk (quirks.ts), rolled from the run and the stage so a reload offers
//   the same ones.
import { createSeededRng, shuffle } from '../rng.ts';
import { DRAFT_CHOICES, MAX_ROSTER_SIZE, RECRUIT_CLASS_IDS, rollRecruit } from './rewards.ts';
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
// else a recruitment stage (isRecruitmentStage).
export function hasGuest(run: RunState): boolean {
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

// The recruits the draft after `stage` offers `run`: DRAFT_CHOICES of them
// (fewer if there are fewer recruit classes), each of a different class
// and with a different name, id and quirk. Always the same for the same
// run and stage.
export function rollDraft(run: RunState, stage: number): readonly UnitSnapshot[] {
  const rng = createSeededRng((run.seed ^ Math.imul(stage + 0x6472, 0xcc9e2d51) ^ 0x64726166) >>> 0);
  const recruits: UnitSnapshot[] = [];
  for (const classId of shuffle(rng, RECRUIT_CLASS_IDS).slice(0, DRAFT_CHOICES)) {
    recruits.push(
      rollRecruit(run, stage, rng, undefined, {
        classId,
        takenNames: recruits.map((unit) => unit.name),
        takenIds: recruits.map((unit) => unit.id),
        takenQuirks: recruits.map((unit) => unit.quirk!),
      }),
    );
  }
  return Object.freeze(recruits);
}

// The run after its pending draft is settled: recruit `index` of the
// draft's offers joins the roster (while it has room), or with null nobody
// does. A run with no draft owed is returned as it is.
export function settleDraft(run: RunState, index: number | null): RunState {
  if (run.pendingDraft === undefined) return run;
  const { pendingDraft, ...rest } = run;
  const recruit = index === null ? undefined : rollDraft(run, pendingDraft)[index];
  if (index !== null && !recruit) throw new RangeError(`No draft offer ${index}`);
  const joins = recruit && run.roster.length < MAX_ROSTER_SIZE;
  return Object.freeze({ ...rest, roster: joins ? Object.freeze([...run.roster, recruit]) : run.roster });
}
