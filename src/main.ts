import Phaser from 'phaser';
import { gameStore, type BattleSetup, type GameState } from './bridge/gameStore.ts';
import { GridScene } from './scenes/GridScene.ts';
import { mountUI } from './ui/mountUI.tsx';
import { startAudio } from './audio/index.ts';
import { getRenderSize } from './game/camera.ts';

// React renders the page first: it owns the layout, including the #game
// element the canvas goes in.
mountUI(document.getElementById('root')!);
startAudio();

// No scenes run at boot: the React title screen is shown first, and the map
// scene is only started once the player picks a battle.
// The canvas fills #game, which the page layout stretches to fill the
// space below the header, at the screen's own pixel density
// (getRenderSize): it has devicePixelRatio canvas pixels per CSS pixel and
// is shown at 1 / that zoom, so a scaled display draws sharp rather than
// stretching a CSS-pixel canvas. The map scene decides how far to zoom in.
const gameBox = document.getElementById('game')!;
const renderSize = () => getRenderSize(gameBox.getBoundingClientRect(), window.devicePixelRatio);
const initial = renderSize();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameBox,
  scale: {
    mode: Phaser.Scale.NONE,
    width: initial.width,
    height: initial.height,
    zoom: 1 / initial.pixelRatio,
  },
  backgroundColor: '#1f140c',
  pixelArt: true,
  scene: [],
});

// Follows the box's size and the screen's density (which changes when the
// window moves to another monitor or the browser zooms).
function fitCanvas() {
  const { width, height, pixelRatio } = renderSize();
  if (width !== game.scale.width || height !== game.scale.height) game.scale.resize(width, height);
  if (game.scale.zoom !== 1 / pixelRatio) game.scale.setZoom(1 / pixelRatio);
}
new ResizeObserver(fitCanvas).observe(gameBox);
window.addEventListener('resize', fitCanvas);

// The map scene lives only while the battle (or preview) screen is up:
// added (and so started fresh) when one opens, removed when the player
// returns to the title. The store's battleSetup is passed in as scene data,
// and a new one (the next battle after a victory, or another preview map)
// restarts the scene with it.
let runningSetup: BattleSetup | null = null;
function syncMapScene(state: GameState) {
  const scene = game.scene.getScene('Grid');
  const onMap = state.screen === 'battle' || state.screen === 'preview';
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
