import Phaser from 'phaser';
import type { FighterAction, FighterColor, FighterSkin } from './types';

export const FIGHTER_SHEETS: Record<FighterSkin, string> = {
  astra: '/assets/characters/astra-nyx-sheet.webp',
  kael: '/assets/characters/kael-forge-sheet.webp',
};

const FRAME_SEQUENCES: Record<FighterAction, readonly number[]> = {
  intro: [5, 0, 1, 0],
  idle: [0, 1, 0, 1],
  run: [2, 3, 4, 3],
  dash: [5, 6, 6],
  jump: [7, 8, 8, 9],
  attack: [10, 10, 11, 11, 14],
  kick: [15, 15, 16, 16, 15],
  special: [12, 12, 13, 13, 14],
  block: [17, 17],
  hurt: [18, 18],
  ko: [18, 19, 19, 19],
  victory: [14, 13, 13, 14],
};

export const ACTION_FRAMES: Record<FighterAction, number> = Object.fromEntries(
  Object.entries(FRAME_SEQUENCES).map(([action, frames]) => [action, frames.length]),
) as Record<FighterAction, number>;

export const ACTION_SPEED: Record<FighterAction, number> = {
  intro: 180,
  idle: 180,
  run: 92,
  dash: 70,
  jump: 115,
  attack: 72,
  kick: 78,
  special: 94,
  block: 170,
  hurt: 105,
  ko: 150,
  victory: 210,
};

const COLOR_VALUES: Record<FighterColor, number> = {
  azure: 0x38bdf8,
  crimson: 0xfb4f58,
  emerald: 0x34d399,
  violet: 0x8b5cf6,
  gold: 0xfbbf24,
  fuchsia: 0xe879f9,
  cyan: 0x22d3ee,
  lime: 0xa3e635,
  orange: 0xfb923c,
  ice: 0xdbeafe,
  coral: 0xfda4af,
  silver: 0xcbd5e1,
};

export function fighterTextureKey(skin: FighterSkin): string {
  return `fighter-${skin}`;
}

export function fighterFrame(action: FighterAction, animationFrame: number): number {
  const sequence = FRAME_SEQUENCES[action];
  return sequence[animationFrame % sequence.length] ?? sequence[0];
}

export function fighterColorValue(color: FighterColor): number {
  return COLOR_VALUES[color];
}

export function ensureEffectTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('particle-white')) {
    const particle = scene.textures.createCanvas('particle-white', 20, 20);
    if (particle) {
      const context = particle.getContext();
      const gradient = context.createRadialGradient(10, 10, 0, 10, 10, 10);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.38, '#ffffff');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 20, 20);
      particle.refresh();
    }
  }

  if (!scene.textures.exists('impact-slash')) {
    const slash = scene.textures.createCanvas('impact-slash', 160, 72);
    if (slash) {
      const context = slash.getContext();
      const gradient = context.createLinearGradient(0, 36, 160, 36);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.42, 'rgba(255,255,255,.92)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.strokeStyle = gradient;
      context.lineCap = 'round';
      context.lineWidth = 9;
      context.beginPath();
      context.moveTo(8, 62);
      context.quadraticCurveTo(78, 5, 152, 22);
      context.stroke();
      context.globalAlpha = 0.55;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(30, 69);
      context.quadraticCurveTo(92, 18, 145, 34);
      context.stroke();
      slash.refresh();
    }
  }
}
