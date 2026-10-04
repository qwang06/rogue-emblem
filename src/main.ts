import Phaser from 'phaser';
import { gameStore } from './bridge/gameStore.ts';
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

// The map scene lives only while the battle screen is up: added (and so
// started fresh) on Story Mode or Training, removed when the player returns to the
// title. The battle setup the title screen chose is passed in as scene data.
gameStore.subscribe((state) => {
  const running = Boolean(game.scene.getScene('Grid'));
  if (state.screen === 'battle' && !running) {
    game.scene.add('Grid', GridScene, true, state.battleSetup ?? undefined);
  } else if (state.screen === 'title' && running) {
    game.scene.remove('Grid');
  }
});
