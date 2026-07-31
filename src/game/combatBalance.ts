import type { FighterSkin, WeaponId } from './types';

export interface FighterStats {
  speed: number;
  jump: number;
  dash: number;
  damage: number;
  defense: number;
  energy: number;
}

export interface WeaponProfile {
  range: number;
  damage: number;
  windup: number;
  active: number;
  recovery: number;
  knockback: number;
}

export const FIGHTER_STATS: Record<FighterSkin, FighterStats> = {
  mage: { speed: 0.94, jump: 1, dash: 0.96, damage: 0.92, defense: 1.06, energy: 0.95 },
  minion: { speed: 1.1, jump: 1.08, dash: 1.1, damage: 0.94, defense: 1.06, energy: 1.08 },
  rogue: { speed: 1.15, jump: 1.06, dash: 1.16, damage: 0.98, defense: 1.08, energy: 1.1 },
  warrior: { speed: 0.88, jump: 0.92, dash: 0.9, damage: 1.16, defense: 0.88, energy: 0.92 },
};

export const weaponProfile = (weapon: WeaponId): WeaponProfile => {
  if (weapon.startsWith('bow_') || weapon === 'Skeleton_Crossbow') {
    return { range: 900, damage: 0.9, windup: 330, active: 620, recovery: 760, knockback: 250 };
  }
  if (weapon.includes('Staff') || weapon.startsWith('staff_') || weapon === 'wand_A') {
    return { range: 560, damage: 0.78, windup: 440, active: 720, recovery: 980, knockback: 210 };
  }
  if (weapon.startsWith('hammer_') || weapon === 'halberd') {
    return { range: 420, damage: 1.28, windup: 245, active: 610, recovery: 760, knockback: 390 };
  }
  if (weapon === 'spear_A') {
    return { range: 465, damage: 1.08, windup: 195, active: 520, recovery: 630, knockback: 315 };
  }
  if (weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')) {
    return { range: 365, damage: 0.86, windup: 95, active: 300, recovery: 350, knockback: 235 };
  }
  if (weapon.startsWith('axe_') || weapon === 'Skeleton_Axe') {
    return { range: 390, damage: 1.14, windup: 175, active: 470, recovery: 570, knockback: 325 };
  }
  return { range: 375, damage: 1, windup: 130, active: 390, recovery: 470, knockback: 280 };
};
