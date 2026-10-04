import { HeaderPopover } from './HeaderPopover.tsx';

// Header button that opens the settings panel. There are no settings yet, so
// the panel is a placeholder; it doesn't touch the game.
export function SettingsButton() {
  return (
    <HeaderPopover button="Settings" title="Settings">
      <p className="settings__empty">Nothing to adjust yet.</p>
    </HeaderPopover>
  );
}
