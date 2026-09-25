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

gameStore.subscribe((state) => {
  if (state.screen === 'battle' && !game.scene.getScene('Grid')) {
    game.scene.add('Grid', GridScene, true);
  }
});

mountUI(document.getElementById('ui'));
