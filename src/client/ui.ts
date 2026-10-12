import Phaser from 'phaser';

export const FONT = '"Courier New", Consolas, monospace';

export const C = {
  bgDark: 0x2b3a2e,
  sky: 0x3f6246,
  mid: 0x4a9d44,
  bright: 0x6bd35a,
  light: 0xa8e66e,
  textHex: '#b9f58a',
  dimHex: '#7fb86a',
  warnHex: '#ffffff',
} as const;

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size = 20,
  align: 'left' | 'center' | 'right' = 'left',
  color: string = C.textHex,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    align,
  });
  t.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0);
  return t;
}

/** Only touches the texture when the string actually changed (Phaser re-renders the text on every setText). */
export function setIfChanged(t: Phaser.GameObjects.Text, str: string): void {
  if (t.text !== str) t.setText(str);
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(C.bgDark, 0.85).fillRect(x, y, w, h);
  g.lineStyle(3, C.light, 1).strokeRect(x, y, w, h);
  return g;
}
