import { UnitPanel } from './UnitPanel.jsx';

// Root of the HUD overlay. Sits on top of the Phaser canvas; the root
// ignores pointer events so clicks fall through to the game, and
// individual panels opt back in via CSS.
export function App() {
  return (
    <div className="hud">
      <UnitPanel />
    </div>
  );
}
