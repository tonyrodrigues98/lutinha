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
  barbarian: { speed: 0.9, jump: 0.96, dash: 0.92, damage: 1.14, defense: 0.93, energy: 0.94 },
  knight: { speed: 0.94, jump: 0.96, dash: 0.96, damage: 1.03, defense: 0.9, energy: 0.98 },
  adventurerMage: { speed: 0.96, jump: 1.02, dash: 0.98, damage: 0.94, defense: 1.04, energy: 1.04 },
  ranger: { speed: 1.08, jump: 1.05, dash: 1.08, damage: 0.96, defense: 1.04, energy: 1.05 },
  adventurerRogue: { speed: 1.14, jump: 1.07, dash: 1.14, damage: 0.98, defense: 1.07, energy: 1.08 },
  hoodedRogue: { speed: 1.12, jump: 1.05, dash: 1.12, damage: 1, defense: 1.06, energy: 1.06 },
  mannequinMedium: { speed: 1, jump: 1, dash: 1, damage: 1, defense: 1, energy: 1 },
  mannequinLarge: { speed: 0.84, jump: 0.88, dash: 0.86, damage: 1.2, defense: 0.86, energy: 0.88 },
};

export const weaponProfile = (weapon: WeaponId): WeaponProfile => {
  if (
    weapon === 'bow'
    || weapon === 'bow_withString'
    || weapon.startsWith('bow_')
    || weapon === 'Skeleton_Crossbow'
    || weapon.startsWith('crossbow_')
  ) {
    return { range: 900, damage: 0.9, windup: 330, active: 620, recovery: 760, knockback: 250 };
  }
  if (
    weapon.includes('Staff')
    || weapon === 'staff'
    || weapon.startsWith('staff_')
    || weapon === 'wand'
    || weapon === 'wand_A'
    || weapon.startsWith('spellbook_')
  ) {
    return { range: 560, damage: 0.78, windup: 440, active: 720, recovery: 980, knockback: 210 };
  }
  if (
    weapon.startsWith('hammer_')
    || weapon === 'halberd'
    || weapon === 'axe_2handed'
    || weapon.startsWith('sword_2handed')
  ) {
    return { range: 420, damage: 1.28, windup: 245, active: 610, recovery: 760, knockback: 390 };
  }
  if (weapon === 'spear_A') {
    return { range: 465, damage: 1.08, windup: 195, active: 520, recovery: 630, knockback: 315 };
  }
  if (weapon === 'dagger' || weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')) {
    return { range: 365, damage: 0.86, windup: 95, active: 300, recovery: 350, knockback: 235 };
  }
  if (weapon.startsWith('axe_') || weapon === 'Skeleton_Axe') {
    return { range: 390, damage: 1.14, windup: 175, active: 470, recovery: 570, knockback: 325 };
  }
  return { range: 375, damage: 1, windup: 130, active: 390, recovery: 470, knockback: 280 };
};
