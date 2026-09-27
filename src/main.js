import Phaser from 'phaser';
import { gameStore } from './bridge/gameStore.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GridScene } from './scenes/GridScene.js';
import { mountUI } from './ui/mountUI.jsx';

// React renders the page first: it owns the layout, including the #game
// element the canvas goes in.
mountUI(document.getElementById('root'));

// No scenes run at boot: the React title screen is shown first, and the map
// scene is only started once the player chooses Play.
// The canvas keeps a fixed 960x720 resolution and FIT scales it to fill
// #game, whose size the page layout sets to fit the window.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scene: [],
});

// The map scene lives only while the battle screen is up: added (and so
// started fresh) on Play or Training, removed when the player returns to the
// title. The battle setup the title screen chose is passed in as scene data.
gameStore.subscribe((state) => {
  const running = Boolean(game.scene.getScene('Grid'));
  if (state.screen === 'battle' && !running) {
    game.scene.add('Grid', GridScene, true, state.battleSetup);
  } else if (state.screen === 'title' && running) {
    game.scene.remove('Grid');
  }
});
