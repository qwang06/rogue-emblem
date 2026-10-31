import Phaser from 'phaser';
import { BLOB, HAZE } from '../game/battlefieldKit.ts';

const SIZE = 128; // each texture's side, stretched to whatever it covers

// The washes a battlefield kit lays over its ground (see layOutKit),
// built once and filtered smoothly: BLOB, a white pool fading out to
// nothing at its edge, and HAZE, white at its top fading out downward.
// Both are tinted to the kit's colors where they're drawn.
export function ensureKitTextures(scene: Phaser.Scene) {
  const make = (key: string, paint: (context: CanvasRenderingContext2D) => CanvasGradient) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, SIZE, SIZE)!;
    const context = texture.getContext();
    context.fillStyle = paint(context);
    context.fillRect(0, 0, SIZE, SIZE);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  make(BLOB, (context) => {
    const r = SIZE / 2;
    const gradient = context.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    return gradient;
  });
  make(HAZE, (context) => {
    const gradient = context.createLinearGradient(0, 0, 0, SIZE);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    return gradient;
  });
}
