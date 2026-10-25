// Plays many Warband runs by themselves and prints how they went, for
// balancing: `npm run sim -- --runs 50 --stages 25 --policy default`.
// Loads the game's modules through Vite (they use Vite-only imports), so
// it runs as plain `node scripts/sim.ts`.

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { runnerImport } from 'vite';

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '20' },
    stages: { type: 'string', default: '25' },
    policy: { type: 'string', default: 'default' },
    // Starting classes or origins (see origins.ts) to play.
    class: { type: 'string', multiple: true },
    // The Heat level the runs are played at (see heat.ts).
    heat: { type: 'string', default: '0' },
    // Writes the worst run's script here, to replay it (replayRun).
    worst: { type: 'string' },
  },
});

const { module: sim } = await runnerImport<typeof import('../src/game/warband/simulate.ts')>(
  './src/game/warband/simulate.ts',
);
const { module: autoRun } = await runnerImport<typeof import('../src/game/warband/autoRun.ts')>(
  './src/game/warband/autoRun.ts',
);
const { module: runPolicy } = await runnerImport<typeof import('../src/game/warband/runPolicy.ts')>(
  './src/game/warband/runPolicy.ts',
);

const policies = { baseline: autoRun.BASELINE_POLICY, default: runPolicy.DEFAULT_POLICY };
const policy = policies[values.policy as keyof typeof policies];
if (!policy) throw new Error(`Unknown policy ${values.policy}: use ${Object.keys(policies).join(' or ')}`);

const started = performance.now();
const starts = sim.getSimStarts(Number(values.runs), values.class, Number(values.heat));
const { byClass, worst } = sim.simulate(starts, policy, {
  maxStages: Number(values.stages),
});
console.log(`${values.policy} policy, ${starts.length} runs, up to ${values.stages} stages, Heat ${values.heat}`);
console.log(sim.formatSummary(byClass));
console.log(`(${((performance.now() - started) / 1000).toFixed(1)}s)`);
if (values.worst && worst) {
  writeFileSync(values.worst, JSON.stringify(worst.script));
  console.log(`Worst run (${worst.script.start.classId}, seed ${worst.script.start.seed}) written to ${values.worst}`);
}
