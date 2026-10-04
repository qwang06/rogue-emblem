import type { MouseEvent } from 'react';
import { gameCommands } from '../bridge/commands.ts';
import { ActionMenu } from './ActionMenu.tsx';
import { BattleResult } from './BattleResult.tsx';
import { CombatForecast } from './CombatForecast.tsx';
import { ConfigEditor } from './ConfigEditor.tsx';
import { ControlsButton } from './ControlsButton.tsx';
import { DamagePopups } from './DamagePopups.tsx';
import { DeploymentBanner } from './DeploymentBanner.tsx';
import { DeploymentMenu } from './DeploymentMenu.tsx';
import { DialogBox } from './DialogBox.tsx';
import { ExperienceBar } from './ExperienceBar.tsx';
import { ItemMenu } from './ItemMenu.tsx';
import { WeaponMenu } from './WeaponMenu.tsx';
import { LevelUpPanel } from './LevelUpPanel.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';
import { MainMenuButton } from './MainMenuButton.tsx';
import { ObjectiveScreen } from './ObjectiveScreen.tsx';
import { PageHeader } from './PageHeader.tsx';
import { PauseMenu } from './PauseMenu.tsx';
import { PhaseBanner } from './PhaseBanner.tsx';
import { RosterMenu } from './RosterMenu.tsx';
import { SettingsButton } from './SettingsButton.tsx';
import { SkillMenu } from './SkillMenu.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { TurnIndicator } from './TurnIndicator.tsx';
import { UnitPanel } from './UnitPanel.tsx';
import { useGameStore } from './useGameStore.ts';
import { useRoute } from './useRoute.ts';

// Root of the page. The battle layout is always mounted, because #game is
// where Phaser put its canvas at boot; the title screen covers it while
// `screen` is 'title', and `LoadingScreen` covers it while a battle's map
// loads. On the #/configs routes, `ConfigEditor` covers it instead.
//
// Inside the stage, the HUD overlay sits on top of the canvas: the overlay
// ignores pointer events so clicks fall through to the game, and
// individual panels opt back in via CSS. All in-battle UI goes there (the
// unit panel included, so the map gets the whole width); reference panels
// like the controls drop down from header buttons.
function cancelOnRightClick(event: MouseEvent) {
  event.preventDefault();
  gameCommands.send({ type: 'cancel' });
}

export function App() {
  const screen = useGameStore((state) => state.screen);
  const route = useRoute();

  return (
    <div className="page">
      <PageHeader
        actions={
          <>
            <ControlsButton />
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
              {/* First, so every other overlay paints over it. */}
              <UnitPanel />
              <DeploymentMenu />
              <RosterMenu />
              <ActionMenu />
              <WeaponMenu />
              <SkillMenu />
              <ItemMenu />
              <CombatForecast />
              <DamagePopups />
              <ExperienceBar />
              <LevelUpPanel />
              <PhaseBanner />
              <DialogBox />
              <ObjectiveScreen />
              <PauseMenu />
              <BattleResult />
            </div>
          </div>
        </div>
      </main>

      {route.page !== 'game' ? (
        <ConfigEditor route={route} />
      ) : (
        <>
          {screen === 'title' && <TitleScreen />}
          {screen === 'battle' && <LoadingScreen />}
        </>
      )}
    </div>
  );
}
