import { HeaderPopover } from './HeaderPopover.tsx';

const CONTROLS = [
  { keys: ['←', '↑', '↓', '→'], action: 'Move cursor (hold to repeat)' },
  { keys: ['Enter', 'Z'], action: 'Confirm' },
  { keys: ['Esc', 'X'], action: 'Cancel' },
  { keys: ['Esc'], action: 'Pause (on the map)' },
  { keys: ['I'], action: 'Unit info (on a unit)' },
  { keys: ['Esc'], action: 'Skip dialog' },
  { keys: ['D'], action: 'Show / hide enemy danger zone' },
  { keys: ['Mouse'], action: 'Point to move cursor' },
  { keys: ['Left click'], action: 'Confirm' },
  { keys: ['Right click'], action: 'Cancel / Pause' },
];

// Header icon button (a keyboard) that drops down the key reference.
export function ControlsButton() {
  return (
    <HeaderPopover button={<KeyboardIcon />} label="Controls" title="Controls" className="header-button--icon">
      <dl className="controls-list">
        {CONTROLS.map(({ keys, action }) => (
          <div key={`${keys.join(' ')}: ${action}`} className="controls-list__row">
            <dt>
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </HeaderPopover>
  );
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 16" width="22" height="15" aria-hidden="true">
      <rect x="1" y="1" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g fill="currentColor">
        <rect x="4" y="4" width="2" height="2" />
        <rect x="8" y="4" width="2" height="2" />
        <rect x="12" y="4" width="2" height="2" />
        <rect x="16" y="4" width="2" height="2" />
        <rect x="6" y="7.5" width="2" height="2" />
        <rect x="10" y="7.5" width="2" height="2" />
        <rect x="14" y="7.5" width="2" height="2" />
        <rect x="18" y="7.5" width="2" height="2" />
        <rect x="7" y="11" width="10" height="1.75" />
      </g>
    </svg>
  );
}
