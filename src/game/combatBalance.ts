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

const MELEE_REACH: Partial<Record<WeaponId, number>> = {
  fistweapon_A: 245, fistweapon_B: 245,
  dagger: 270, dagger_A: 275, dagger_B: 285,
  smokebomb: 290,
  sword_A: 350, sword_B: 365, sword_C: 375, sword_D: 385, sword_E: 395,
  sword_1handed: 370, Skeleton_Blade: 380,
  axe_A: 375, axe_B: 390, axe_C: 405, axe_1handed: 395, Skeleton_Axe: 400,
  hammer_A: 405, hammer_B: 420, hammer_C: 435,
  sword_2handed: 455, sword_2handed_color: 455, axe_2handed: 470,
  staff: 475, staff_A: 490, staff_B: 505, Skeleton_Staff: 500,
  spear_A: 555, halberd: 575,
};

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
    return { range: MELEE_REACH[weapon] ?? 540, damage: 0.78, windup: 440, active: 720, recovery: 980, knockback: 210 };
  }
  if (
    weapon.startsWith('hammer_')
    || weapon === 'halberd'
    || weapon === 'axe_2handed'
    || weapon.startsWith('sword_2handed')
  ) {
    return { range: MELEE_REACH[weapon] ?? 450, damage: 1.28, windup: 245, active: 610, recovery: 760, knockback: 390 };
  }
  if (weapon === 'spear_A') {
    return { range: MELEE_REACH[weapon] ?? 555, damage: 1.08, windup: 195, active: 520, recovery: 630, knockback: 315 };
  }
  if (weapon === 'dagger' || weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')) {
    return { range: MELEE_REACH[weapon] ?? 270, damage: 0.86, windup: 95, active: 300, recovery: 350, knockback: 235 };
  }
  if (weapon.startsWith('axe_') || weapon === 'Skeleton_Axe') {
    return { range: MELEE_REACH[weapon] ?? 390, damage: 1.14, windup: 175, active: 470, recovery: 570, knockback: 325 };
  }
  return { range: MELEE_REACH[weapon] ?? 370, damage: 1, windup: 130, active: 390, recovery: 470, knockback: 280 };
};
