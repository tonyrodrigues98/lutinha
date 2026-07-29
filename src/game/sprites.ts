import Phaser from 'phaser';
import type { FighterAction, FighterSkin, Team } from './types';

const SIZE = { width: 180, height: 220 };

export const ACTION_FRAMES: Record<FighterAction, number> = {
  idle: 8,
  run: 10,
  dash: 6,
  jump: 5,
  attack: 8,
  kick: 9,
  special: 12,
  block: 4,
  hurt: 4,
  ko: 8,
};

export const ACTION_SPEED: Record<FighterAction, number> = {
  idle: 90,
  run: 58,
  dash: 34,
  jump: 84,
  attack: 44,
  kick: 48,
  special: 54,
  block: 88,
  hurt: 60,
  ko: 78,
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

export function fighterTextureKey(team: Team, skin: FighterSkin, action: FighterAction, frame: number): string {
  return `fighter-${team}-${skin}-${action}-${frame}`;
}

export function ensureFighterTextures(scene: Phaser.Scene, selectedTeam?: Team, selectedSkin?: FighterSkin): void {
  const targets: Array<[Team, FighterSkin]> = selectedTeam && selectedSkin ? [[selectedTeam, selectedSkin]] : [];
  targets.forEach(([team, skin]) => {
    (Object.keys(ACTION_FRAMES) as FighterAction[]).forEach((action) => {
      for (let frame = 0; frame < ACTION_FRAMES[action]; frame += 1) {
        const key = fighterTextureKey(team, skin, action, frame);
        if (scene.textures.exists(key)) continue;
        const texture = scene.textures.createCanvas(key, SIZE.width, SIZE.height);
        if (!texture) continue;
        drawFighter(texture.getContext(), team, skin, action, frame, ACTION_FRAMES[action]);
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
  skin: FighterSkin,
  action: FighterAction,
  frame: number,
  frameCount: number,
): void {
  const baseColors = palette[team];
  const armor = {
    vanguard: baseColors.armor,
    ronin: '#18181b',
    titan: '#292524',
    wraith: '#2e1065',
  }[skin];
  const accent = {
    vanguard: baseColors.light,
    ronin: '#fbbf24',
    titan: '#f59e0b',
    wraith: '#c4b5fd',
  }[skin];
  const colors = { ...baseColors, armor };
  const phase = (frame / frameCount) * Math.PI * 2;
  const idle = Math.sin(phase);
  const run = Math.sin(phase);
  let bodyX = SIZE.width / 2;
  let bodyY = 105 + idle * (action === 'idle' ? 3 : 0);
  let rotation = 0;
  let crouch = 0;
  let fade = 1;

  if (action === 'run') bodyY += Math.abs(run) * 4;
  if (action === 'dash') { crouch = 13; bodyX += 5; rotation = 0.11; }
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

  if (action === 'dash') {
    context.save();
    context.globalAlpha = 0.18 + frame * 0.035;
    context.strokeStyle = accent;
    context.shadowColor = baseColors.core;
    context.shadowBlur = 16;
    context.lineCap = 'round';
    for (let trail = 0; trail < 3; trail += 1) {
      context.lineWidth = 8 - trail * 2;
      context.beginPath();
      context.moveTo(-35 - trail * 12, -35 + trail * 30);
      context.lineTo(-82 - frame * 3, -25 + trail * 31);
      context.stroke();
    }
    context.restore();
  }

  const runSwing = action === 'run' ? run * 21 : 0;
  const jumpTuck = action === 'jump' ? 16 : 0;
  const attackProgress = action === 'attack' ? frame / (frameCount - 1) : 0;
  const kickProgress = action === 'kick' ? frame / (frameCount - 1) : 0;
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

  let backKnee: [number, number] = [-21 - runSwing * 0.3, 65 - jumpTuck];
  let frontKnee: [number, number] = [21 + runSwing * 0.3, 65 - jumpTuck];
  let backFoot: [number, number] = [-24 + runSwing, 91 - jumpTuck + Math.max(0, -runSwing) * 0.2];
  let frontFoot: [number, number] = [24 - runSwing, 91 - jumpTuck + Math.max(0, runSwing) * 0.2];
  if (action === 'kick') {
    const reach = Math.sin(Math.min(1, kickProgress * 1.3) * Math.PI) * 47;
    frontKnee = [27 + reach * 0.3, 52 - reach * 0.32];
    frontFoot = [25 + reach, 58 - reach * 0.28];
    backKnee = [-24, 69];
    backFoot = [-30, 93];
    rotation = -0.07 * Math.sin(kickProgress * Math.PI);
  }
  if (action === 'dash') {
    backKnee = [-34, 62];
    backFoot = [-52, 80];
    frontKnee = [30, 56];
    frontFoot = [49, 70];
  }

  if (skin === 'wraith') {
    context.save();
    context.globalAlpha = 0.72;
    context.fillStyle = '#1e1b4b';
    context.strokeStyle = baseColors.core;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-25, -25);
    context.quadraticCurveTo(-45, 42, -34 - idle * 5, 93);
    context.lineTo(0, 72);
    context.lineTo(38 + idle * 4, 94);
    context.quadraticCurveTo(45, 35, 24, -25);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  } else if (skin === 'ronin') {
    context.save();
    context.strokeStyle = '#09090b';
    context.lineWidth = 11;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-34, -42);
    context.lineTo(42, 68);
    context.stroke();
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.stroke();
    context.restore();
  }

  const build = skin === 'titan' ? 1.22 : skin === 'ronin' || skin === 'wraith' ? 0.88 : 1;
  limb(context, [[-13, 40], backKnee, backFoot], 15 * build, colors.dark, colors.core);
  limb(context, [[13, 40], frontKnee, frontFoot], 16 * build, colors.core, colors.light);
  limb(context, [[-22, -10], [-31, 10], backHand], 13 * build, colors.dark, colors.core);

  context.save();
  context.shadowColor = colors.glow;
  context.shadowBlur = 16;
  context.fillStyle = colors.armor;
  context.strokeStyle = '#030712';
  context.lineWidth = 7;
  const torsoWidth = skin === 'titan' ? 38 : skin === 'ronin' ? 24 : skin === 'wraith' ? 26 : 27;
  const shoulderWidth = skin === 'titan' ? 43 : skin === 'ronin' ? 31 : 33;
  const torsoBottom = skin === 'titan' ? 57 : skin === 'ronin' ? 45 : 50;
  context.beginPath();
  context.moveTo(-torsoWidth, -27);
  context.lineTo(-shoulderWidth, 30);
  context.lineTo(0, torsoBottom);
  context.lineTo(shoulderWidth, 30);
  context.lineTo(torsoWidth, -27);
  context.lineTo(0, -39);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  context.strokeStyle = accent;
  context.fillStyle = colors.core;
  context.lineWidth = 3;
  if (skin === 'ronin') {
    context.beginPath();
    context.moveTo(-25, -16);
    context.lineTo(27, 18);
    context.lineTo(18, 29);
    context.lineTo(-29, -3);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = accent;
    context.fillRect(-29, 27, 58, 8);
  } else if (skin === 'titan') {
    context.beginPath();
    context.arc(0, 2, 18, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#020617';
    context.beginPath();
    context.arc(0, 2, 8 + idle, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = baseColors.light;
    context.stroke();
  } else if (skin === 'wraith') {
    context.beginPath();
    context.moveTo(0, -22);
    context.quadraticCurveTo(25, 1, 0, 31);
    context.quadraticCurveTo(-25, 1, 0, -22);
    context.fill();
    context.stroke();
    context.fillStyle = accent;
    context.beginPath();
    context.arc(1, 3, 5 + Math.abs(idle) * 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(-18, -18);
    context.lineTo(0, 29);
    context.lineTo(18, -18);
    context.lineTo(0, -7);
    context.closePath();
    context.fill();
    context.stroke();
  }

  if (skin === 'titan') {
    for (const side of [-1, 1]) {
      context.save();
      context.fillStyle = '#44403c';
      context.strokeStyle = accent;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(side * 34, -20, 17, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
    }
  }

  const scarfWave = idle * 7 + (action === 'run' ? -14 : action === 'dash' ? -25 : 0);
  context.fillStyle = colors.core;
  context.beginPath();
  context.moveTo(-20, -27);
  context.quadraticCurveTo(-44, -19 + scarfWave, -50, 8 + scarfWave);
  context.quadraticCurveTo(-34, 0 + scarfWave, -8, -9);
  context.closePath();
  context.fill();

  limb(context, [[22, -10], [33, 8], frontHand], 15 * build, colors.core, colors.light);

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

  if (skin === 'ronin') {
    context.shadowBlur = 6;
    context.fillStyle = accent;
    context.beginPath();
    context.moveTo(-6, headY - 27);
    context.lineTo(2, headY - 49);
    context.lineTo(9, headY - 25);
    context.closePath();
    context.fill();
    context.fillStyle = colors.core;
    context.fillRect(-27, headY + 9, 54, 7);
  } else if (skin === 'titan') {
    context.fillStyle = accent;
    context.beginPath();
    context.moveTo(-20, headY - 20);
    context.lineTo(-42, headY - 38);
    context.lineTo(-27, headY - 5);
    context.moveTo(20, headY - 20);
    context.lineTo(42, headY - 38);
    context.lineTo(27, headY - 5);
    context.fill();
    context.fillStyle = '#44403c';
    context.fillRect(-23, headY + 13, 46, 10);
  } else if (skin === 'wraith') {
    context.globalAlpha = 0.9;
    context.fillStyle = '#1e1b4b';
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(0, headY - 39);
    context.quadraticCurveTo(38, headY - 18, 29, headY + 26);
    context.lineTo(0, headY + 17);
    context.lineTo(-29, headY + 26);
    context.quadraticCurveTo(-38, headY - 18, 0, headY - 39);
    context.fill();
    context.stroke();
    context.fillStyle = baseColors.light;
    context.shadowBlur = 18;
    context.fillRect(-14, headY - 4, 28, 3);
  }
  context.restore();

  if (action === 'attack' || action === 'kick' || action === 'special') {
    const impactPoint = action === 'kick' ? frontFoot : frontHand;
    const radius = action === 'special' ? 18 + Math.sin(specialProgress * Math.PI) * 20 : action === 'kick' ? 15 : 12;
    context.save();
    context.globalAlpha = 0.8;
    context.strokeStyle = colors.light;
    context.lineWidth = 5;
    context.shadowColor = colors.core;
    context.shadowBlur = 22;
    context.beginPath();
    context.arc(impactPoint[0], impactPoint[1], radius, phase, phase + Math.PI * 1.5);
    context.stroke();
    if (action === 'special') {
      context.lineWidth = 3;
      context.beginPath();
      context.arc(impactPoint[0], impactPoint[1], radius + 10, -phase, -phase + Math.PI);
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
