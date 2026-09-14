import Phaser from 'phaser';

class HelloWorldScene extends Phaser.Scene {
  constructor() {
    super('HelloWorld');
  }

  create() {
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Hello World', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  scene: [HelloWorldScene],
});
