import Phaser from 'phaser';
import { gameStore, type BattleSetup, type GameState } from './bridge/gameStore.ts';
import { GridScene } from './scenes/GridScene.ts';
import { mountUI } from './ui/mountUI.tsx';

// React renders the page first: it owns the layout, including the #game
// element the canvas goes in.
mountUI(document.getElementById('root')!);

// No scenes run at boot: the React title screen is shown first, and the map
// scene is only started once the player picks a battle.
// RESIZE keeps the canvas the same size as #game, which the page layout
// stretches to fill the space below the header, so one canvas pixel is
// one CSS pixel and the map scene decides how far to zoom in.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scene: [],
});

// The map scene lives only while the battle (or preview) screen is up:
// added (and so started fresh) when one opens, removed when the player
// returns to the title. The store's battleSetup is passed in as scene data,
// and a new one (the next battle after a victory, or another preview map)
// restarts the scene with it.
let runningSetup: BattleSetup | null = null;
function syncMapScene(state: GameState) {
  const scene = game.scene.getScene('Grid');
  const onMap = state.screen !== 'title';
  if (onMap && !scene) {
    runningSetup = state.battleSetup;
    game.scene.add('Grid', GridScene, true, state.battleSetup ?? undefined);
  } else if (!onMap && scene) {
    game.scene.remove('Grid');
  } else if (onMap && scene && state.battleSetup !== runningSetup) {
    runningSetup = state.battleSetup;
    scene.scene.restart(state.battleSetup ?? undefined);
  }
}
gameStore.subscribe(syncMapScene);
// The page may already be on the map: mountUI runs React's effects before
// this point, so a preview link opened directly has set its screen already.
syncMapScene(gameStore.getState());
