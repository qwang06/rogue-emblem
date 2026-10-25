import { gameCommands } from '../bridge/commands.ts';
import type { MemorialView, RunSummaryView } from '../bridge/runSummaryView.ts';
import { KeyHint } from './KeyHint.tsx';
import { UnitSprite } from './UnitSprite.tsx';

// The recap of a Warband Mode run that has ended, in place of the plain
// result: how far it got, the run's numbers, its MVP and the renown it
// earned toward the next unlock, then a memorial line for every unit lost
// and the relics it held (side by side on a wide stage, stacked on a
// narrow one). A click (or confirm, which GridScene handles) returns to
// the title.
export function RunSummary({ summary }: { summary: RunSummaryView }) {
  const { renown } = summary;
  const stats: [string, string | number][] = [
    ['Stages', summary.stagesCleared],
    ['Bosses', summary.bossesDefeated],
    ['Kills', summary.kills],
    ['Time', summary.playTime],
  ];
  const hasSide = summary.memorial.length > 0 || summary.relics.length > 0;
  return (
    <div className="pause-overlay">
      <section
        className={`panel run-summary run-summary--${summary.won ? 'won' : 'fell'}${hasSide ? ' run-summary--wide' : ''}`}
        role="alert"
        onClick={() => gameCommands.send({ type: 'confirm' })}
      >
        <h2 className="run-summary__title">{summary.won ? 'The Warband Prevailed' : 'The Warband Fell'}</h2>
        <p className="run-summary__line">
          {summary.won ? `Won the run on stage ${summary.stage}.` : `Fell on stage ${summary.stage}.`}
          {summary.survivors > 0 && ` ${summary.survivors} still standing.`}
          {summary.origin && ` Started as ${summary.origin}${summary.heat > 0 ? ` at Heat ${summary.heat}` : ''}.`}
        </p>

        <div className="run-summary__columns">
          <div className="run-summary__column">
            <dl className="run-summary__stats">
              {stats.map(([label, value]) => (
                <div key={label} className="run-summary__stat">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {summary.mvp && (
              <div className="run-summary__mvp">
                <UnitSprite sprite={summary.mvp.sprite} scale={1.5} animated />
                <div className="run-summary__mvp-text">
                  <p className="run-summary__label">MVP</p>
                  <p className="run-summary__name">{summary.mvp.name}</p>
                  <p className="run-summary__meta">
                    Lv {summary.mvp.level} {summary.mvp.classLabel} · {summary.mvp.kills}{' '}
                    {summary.mvp.kills === 1 ? 'kill' : 'kills'}
                  </p>
                </div>
              </div>
            )}

            <div className="run-summary__section">
              <p className="run-summary__label">Renown</p>
              <ul className="run-summary__renown-lines">
                {renown.lines.map((line) => (
                  <li key={line.label}>
                    <span>
                      {line.label}
                      {line.count > 1 && ` ×${line.count}`}
                    </span>
                    <span>+{line.renown}</span>
                  </li>
                ))}
                <li className="run-summary__renown-total">
                  <span>Total</span>
                  <span>{renown.total}</span>
                </li>
              </ul>
              {renown.unlocked.map((label) => (
                <p key={label} className="run-summary__unlocked">
                  Unlocked: {label}!
                </p>
              ))}
              {renown.next && (
                <p className="run-summary__next">
                  Next: {renown.next.label} at {renown.next.renown}
                </p>
              )}
            </div>
          </div>

          {hasSide && (
            <div className="run-summary__column">
              {summary.memorial.length > 0 && (
                <div className="run-summary__section">
                  <p className="run-summary__label">In memory</p>
                  <ul className="run-summary__memorial">
                    {summary.memorial.map((unit) => (
                      <MemorialRow key={unit.key} unit={unit} />
                    ))}
                  </ul>
                </div>
              )}

              {summary.relics.length > 0 && (
                <div className="run-summary__section">
                  <p className="run-summary__label">Relics</p>
                  <p className="run-summary__relics">{summary.relics.join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <KeyHint className="run-summary__hint" entries={[['Enter', 'Return to title']]} />
      </section>
    </div>
  );
}

function MemorialRow({ unit }: { unit: MemorialView }) {
  return (
    <li className="run-summary__fallen">
      <UnitSprite sprite={unit.sprite} />
      <span className="run-summary__fallen-name">{unit.name}</span>
      <span className="run-summary__meta">
        Lv {unit.level} {unit.classLabel}
        {unit.stage !== null && ` · stage ${unit.stage}`}
      </span>
    </li>
  );
}
