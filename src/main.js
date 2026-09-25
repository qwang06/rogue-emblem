import Phaser from 'phaser';
import { gameStore } from './bridge/gameStore.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GridScene } from './scenes/GridScene.js';
import { mountUI } from './ui/mountUI.jsx';

// No scenes run at boot: the React title screen is shown first, and the map
// scene is only started once the player chooses Play.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scene: [],
});

// The map scene lives only while the battle screen is up: added (and so
// started fresh) on Play, removed when the player returns to the title.
gameStore.subscribe((state) => {
  const running = Boolean(game.scene.getScene('Grid'));
  if (state.screen === 'battle' && !running) {
    game.scene.add('Grid', GridScene, true);
  } else if (state.screen === 'title' && running) {
    game.scene.remove('Grid');
  }
});

mountUI(document.getElementById('ui'));
