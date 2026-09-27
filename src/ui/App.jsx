import { gameCommands } from '../bridge/commands.js';
import { ActionMenu } from './ActionMenu.jsx';
import { BattleResult } from './BattleResult.jsx';
import { ControlsPanel } from './ControlsPanel.jsx';
import { DamagePopups } from './DamagePopups.jsx';
import { DeploymentBanner } from './DeploymentBanner.jsx';
import { DeploymentMenu } from './DeploymentMenu.jsx';
import { DialogBox } from './DialogBox.jsx';
import { ItemMenu } from './ItemMenu.jsx';
import { LoadingScreen } from './LoadingScreen.jsx';
import { MainMenuButton } from './MainMenuButton.jsx';
import { PageHeader } from './PageHeader.jsx';
import { PauseMenu } from './PauseMenu.jsx';
import { PhaseBanner } from './PhaseBanner.jsx';
import { RosterMenu } from './RosterMenu.jsx';
import { SettingsButton } from './SettingsButton.jsx';
import { SkillMenu } from './SkillMenu.jsx';
import { TitleScreen } from './TitleScreen.jsx';
import { TurnIndicator } from './TurnIndicator.jsx';
import { UnitPanel } from './UnitPanel.jsx';
import { useGameStore } from './useGameStore.js';

// Root of the page. The battle layout is always mounted, because #game is
// where Phaser put its canvas at boot; the title screen covers it while
// `screen` is 'title', and `LoadingScreen` covers it while a battle's map
// loads.
//
// Inside the stage, the HUD overlay sits on top of the canvas: the overlay
// ignores pointer events so clicks fall through to the game, and
// individual panels opt back in via CSS. Things tied to the map (menus,
// banners, popups) go there; readouts that don't need to cover the map go
// in the header or sidebar.
function cancelOnRightClick(event) {
  event.preventDefault();
  gameCommands.send({ type: 'cancel' });
}

export function App() {
  const screen = useGameStore((state) => state.screen);

  return (
    <div className="page">
      <PageHeader
        actions={
          <>
            <SettingsButton />
            <MainMenuButton />
          </>
        }
      >
        <DeploymentBanner />
        <TurnIndicator />
      </PageHeader>

      <main className="page__main">
        {/* The stage fills this area, and the canvas fills the stage (see ui.css). */}
        <div className="stage-area">
          {/* Right click anywhere on the map or its menus cancels, like Esc. */}
          <div className="stage" onContextMenu={cancelOnRightClick}>
            <div id="game" role="img" aria-label="Battle map" />
            <div className="hud">
              <DeploymentMenu />
              <RosterMenu />
              <ActionMenu />
              <SkillMenu />
              <ItemMenu />
              <DamagePopups />
              <PhaseBanner />
              <DialogBox />
              <PauseMenu />
              <BattleResult />
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <UnitPanel />
          <ControlsPanel />
        </aside>
      </main>

      {screen === 'title' && <TitleScreen />}
      {screen === 'battle' && <LoadingScreen />}
    </div>
  );
}
