import { ActionMenu } from './ActionMenu.jsx';
import { DamagePopups } from './DamagePopups.jsx';
import { DeploymentBanner } from './DeploymentBanner.jsx';
import { DeploymentMenu } from './DeploymentMenu.jsx';
import { RosterMenu } from './RosterMenu.jsx';
import { TitleScreen } from './TitleScreen.jsx';
import { UnitPanel } from './UnitPanel.jsx';
import { useGameStore } from './useGameStore.js';

// Root of the UI overlay. Sits on top of the Phaser canvas; the root
// ignores pointer events so clicks fall through to the game, and
// individual panels opt back in via CSS.
export function App() {
  const screen = useGameStore((state) => state.screen);

  return (
    <div className="hud">
      {screen === 'title' ? (
        <TitleScreen />
      ) : (
        <>
          <DeploymentBanner />
          <UnitPanel />
          <DeploymentMenu />
          <RosterMenu />
          <ActionMenu />
          <DamagePopups />
        </>
      )}
    </div>
  );
}
