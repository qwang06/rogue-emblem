import Phaser from 'phaser';
import { GridScene } from './scenes/GridScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scene: [GridScene],
});
