import Phaser from 'phaser';
import type { FighterAction, Team } from './types';

const SIZE = { width: 150, height: 210 };

export const ACTION_FRAMES: Record<FighterAction, number> = {
  idle: 6,
  run: 8,
  jump: 3,
  attack: 6,
  special: 8,
  block: 3,
  hurt: 3,
  ko: 6,
};

export const ACTION_SPEED: Record<FighterAction, number> = {
  idle: 115,
  run: 72,
  jump: 120,
  attack: 55,
  special: 78,
  block: 115,
  hurt: 80,
  ko: 105,
};

const palette = {
  blue: {
    core: '#38bdf8',
    light: '#e0f2fe',
    dark: '#075985',
    armor: '#172554',
    glow: 'rgba(56,189,248,.75)',
  },
  red: {
    core: '#fb4f58',
    light: '#ffe4e6',
    dark: '#991b1b',
    armor: '#450a0a',
    glow: 'rgba(251,79,88,.75)',
  },
};

export function fighterTextureKey(team: Team, action: FighterAction, frame: number): string {
  return `fighter-${team}-${action}-${frame}`;
}

export function ensureFighterTextures(scene: Phaser.Scene): void {
  (['blue', 'red'] as Team[]).forEach((team) => {
    (Object.keys(ACTION_FRAMES) as FighterAction[]).forEach((action) => {
      for (let frame = 0; frame < ACTION_FRAMES[action]; frame += 1) {
        const key = fighterTextureKey(team, action, frame);
        if (scene.textures.exists(key)) continue;
        const texture = scene.textures.createCanvas(key, SIZE.width, SIZE.height);
        if (!texture) continue;
        drawFighter(texture.getContext(), team, action, frame, ACTION_FRAMES[action]);
        texture.refresh();
      }
    });
  });

  if (!scene.textures.exists('particle-white')) {
    const particle = scene.textures.createCanvas('particle-white', 20, 20);
    if (particle) {
      const context = particle.getContext();
      const gradient = context.createRadialGradient(10, 10, 0, 10, 10, 10);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.4, '#ffffff');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 20, 20);
      particle.refresh();
    }
  }
}

function limb(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  width: number,
  color: string,
  jointColor: string,
): void {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#030712';
  context.lineWidth = width + 8;
  context.beginPath();
  points.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
  for (const [x, y] of points.slice(1, -1)) {
    context.fillStyle = jointColor;
    context.beginPath();
    context.arc(x, y, width * 0.46, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawFighter(
  context: CanvasRenderingContext2D,
  team: Team,
  action: FighterAction,
  frame: number,
  frameCount: number,
): void {
  const colors = palette[team];
  const phase = (frame / frameCount) * Math.PI * 2;
  const idle = Math.sin(phase);
  const run = Math.sin(phase);
  let bodyX = 75;
  let bodyY = 105 + idle * (action === 'idle' ? 3 : 0);
  let rotation = 0;
  let crouch = 0;
  let fade = 1;

  if (action === 'run') bodyY += Math.abs(run) * 4;
  if (action === 'block') { crouch = 10; bodyX -= 3; }
  if (action === 'hurt') { bodyX -= 7 + frame * 2; rotation = -0.08; }
  if (action === 'ko') {
    const progress = frame / Math.max(1, frameCount - 1);
    rotation = -progress * 1.36;
    bodyX -= progress * 30;
    bodyY += progress * 60;
    fade = 1 - progress * 0.18;
  }

  context.clearRect(0, 0, SIZE.width, SIZE.height);
  context.save();
  context.globalAlpha = fade;
  context.translate(bodyX, bodyY + crouch);
  context.rotate(rotation);

  const runSwing = action === 'run' ? run * 21 : 0;
  const jumpTuck = action === 'jump' ? 16 : 0;
  const attackProgress = action === 'attack' ? frame / (frameCount - 1) : 0;
  const specialProgress = action === 'special' ? frame / (frameCount - 1) : 0;
  const guard = action === 'block';

  let backHand: [number, number] = [-28 - runSwing * 0.45, 27 + Math.abs(runSwing) * 0.2];
  let frontHand: [number, number] = [31 + runSwing * 0.45, 25 + Math.abs(runSwing) * 0.2];
  if (guard) {
    backHand = [-12, -31];
    frontHand = [22, -39];
  }
  if (action === 'attack') {
    const reach = Math.sin(Math.min(1, attackProgress * 1.35) * Math.PI) * 48;
    frontHand = [32 + reach, -4 - reach * 0.18];
  }
  if (action === 'special') {
    const reach = Math.sin(Math.min(1, specialProgress * 1.2) * Math.PI) * 60;
    backHand = [8 + reach * 0.35, -38];
    frontHand = [28 + reach, -24];
  }

  const backFoot: [number, number] = [-24 + runSwing, 91 - jumpTuck + Math.max(0, -runSwing) * 0.2];
  const frontFoot: [number, number] = [24 - runSwing, 91 - jumpTuck + Math.max(0, runSwing) * 0.2];

  limb(context, [[-13, 40], [-21 - runSwing * 0.3, 65 - jumpTuck], backFoot], 15, colors.dark, colors.core);
  limb(context, [[13, 40], [21 + runSwing * 0.3, 65 - jumpTuck], frontFoot], 16, colors.core, colors.light);
  limb(context, [[-22, -10], [-31, 10], backHand], 13, colors.dark, colors.core);

  context.save();
  context.shadowColor = colors.glow;
  context.shadowBlur = 16;
  context.fillStyle = colors.armor;
  context.strokeStyle = '#030712';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(-27, -27);
  context.lineTo(-33, 30);
  context.lineTo(0, 50);
  context.lineTo(33, 30);
  context.lineTo(27, -27);
  context.lineTo(0, -39);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  context.fillStyle = colors.core;
  context.beginPath();
  context.moveTo(-18, -18);
  context.lineTo(0, 29);
  context.lineTo(18, -18);
  context.lineTo(0, -7);
  context.closePath();
  context.fill();
  context.strokeStyle = colors.light;
  context.lineWidth = 3;
  context.stroke();

  const scarfWave = idle * 7 + (action === 'run' ? -14 : 0);
  context.fillStyle = colors.core;
  context.beginPath();
  context.moveTo(-20, -27);
  context.quadraticCurveTo(-44, -19 + scarfWave, -50, 8 + scarfWave);
  context.quadraticCurveTo(-34, 0 + scarfWave, -8, -9);
  context.closePath();
  context.fill();

  limb(context, [[22, -10], [33, 8], frontHand], 15, colors.core, colors.light);

  const headY = -55;
  context.save();
  context.shadowColor = colors.glow;
  context.shadowBlur = 12;
  context.fillStyle = '#0b1020';
  context.strokeStyle = '#030712';
  context.lineWidth = 6;
  context.beginPath();
  context.arc(0, headY, 27, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = colors.dark;
  context.beginPath();
  context.moveTo(-25, headY - 4);
  context.lineTo(-12, headY - 25);
  context.lineTo(0, headY - 31);
  context.lineTo(12, headY - 25);
  context.lineTo(25, headY - 4);
  context.lineTo(17, headY + 15);
  context.lineTo(-17, headY + 15);
  context.closePath();
  context.fill();
  context.strokeStyle = colors.core;
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = colors.light;
  context.shadowColor = colors.core;
  context.shadowBlur = 10;
  context.fillRect(3, headY - 5, 15, 4);
  context.restore();

  if (action === 'attack' || action === 'special') {
    const hand = frontHand;
    const radius = action === 'special' ? 18 + Math.sin(specialProgress * Math.PI) * 20 : 12;
    context.save();
    context.globalAlpha = 0.8;
    context.strokeStyle = colors.light;
    context.lineWidth = 5;
    context.shadowColor = colors.core;
    context.shadowBlur = 22;
    context.beginPath();
    context.arc(hand[0], hand[1], radius, phase, phase + Math.PI * 1.5);
    context.stroke();
    if (action === 'special') {
      context.lineWidth = 3;
      context.beginPath();
      context.arc(hand[0], hand[1], radius + 10, -phase, -phase + Math.PI);
      context.stroke();
    }
    context.restore();
  }

  if (guard) {
    context.save();
    context.globalAlpha = 0.55 + frame * 0.1;
    context.strokeStyle = colors.light;
    context.lineWidth = 5;
    context.shadowColor = colors.core;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(30, 0, 54, -1.25, 1.25);
    context.stroke();
    context.restore();
  }

  context.restore();
}
