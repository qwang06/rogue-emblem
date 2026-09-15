import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GridScene } from './scenes/GridScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scene: [GridScene],
});
