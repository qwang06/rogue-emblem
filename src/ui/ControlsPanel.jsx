const CONTROLS = [
  { keys: ['←', '↑', '↓', '→'], action: 'Move cursor' },
  { keys: ['Enter', 'Z'], action: 'Confirm' },
  { keys: ['Esc', 'X'], action: 'Cancel' },
  { keys: ['Esc'], action: 'Pause (on the map)' },
  { keys: ['Mouse'], action: 'Point to move cursor' },
  { keys: ['Left click'], action: 'Confirm' },
  { keys: ['Right click'], action: 'Cancel / Pause' },
];

// Static key reference shown in the sidebar.
export function ControlsPanel() {
  return (
    <section className="side-panel controls-panel">
      <h2 className="side-panel__title">Controls</h2>
      <dl className="controls-panel__list">
        {CONTROLS.map(({ keys, action }) => (
          <div key={action} className="controls-panel__row">
            <dt>
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
