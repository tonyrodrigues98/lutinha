export type Team = 'blue' | 'red';
export type FighterSkin =
  | 'mage'
  | 'minion'
  | 'rogue'
  | 'warrior'
  | 'barbarian'
  | 'knight'
  | 'adventurerMage'
  | 'ranger'
  | 'adventurerRogue'
  | 'hoodedRogue'
  | 'mannequinMedium'
  | 'mannequinLarge';
export type FighterColor = 'azure' | 'crimson' | 'emerald' | 'violet' | 'gold' | 'fuchsia' | 'cyan' | 'lime' | 'orange' | 'ice' | 'coral' | 'silver';
export type ArenaTheme = 'riftfall' | 'ember' | 'neon' | 'astral';
export type AttackKind = 'attack' | 'kick' | 'special';
export type FighterAction = 'intro' | 'idle' | 'run' | 'dash' | 'jump' | AttackKind | 'block' | 'hurt' | 'ko' | 'victory';
export type MatchStatus = 'waiting' | 'countdown' | 'fighting' | 'roundover' | 'matchover';

export const WEAPON_IDS = [
  'Skeleton_Axe',
  'Skeleton_Blade',
  'Skeleton_Crossbow',
  'Skeleton_Staff',
  'axe_A',
  'axe_B',
  'axe_C',
  'bow_A_withString',
  'bow_B_withString',
  'dagger_A',
  'dagger_B',
  'fistweapon_A',
  'fistweapon_B',
  'halberd',
  'hammer_A',
  'hammer_B',
  'hammer_C',
  'spear_A',
  'staff_A',
  'staff_B',
  'sword_A',
  'sword_B',
  'sword_C',
  'sword_D',
  'sword_E',
  'wand_A',
  'axe_1handed',
  'axe_2handed',
  'bow',
  'bow_withString',
  'crossbow_1handed',
  'crossbow_2handed',
  'dagger',
  'smokebomb',
  'spellbook_closed',
  'spellbook_open',
  'staff',
  'sword_1handed',
  'sword_2handed',
  'sword_2handed_color',
  'wand',
] as const;

export type WeaponId = typeof WEAPON_IDS[number];

export const SHIELD_IDS = [
  'none',
  'Skeleton_Shield_Large_A',
  'Skeleton_Shield_Large_B',
  'Skeleton_Shield_Small_A',
  'Skeleton_Shield_Small_B',
  'shield_A',
  'shield_B',
  'shield_C',
  'shield_badge',
  'shield_badge_color',
  'shield_round',
  'shield_round_barbarian',
  'shield_round_color',
  'shield_spikes',
  'shield_spikes_color',
  'shield_square',
  'shield_square_color',
] as const;

export type ShieldId = typeof SHIELD_IDS[number];

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  kick: boolean;
  dash: boolean;
  block: boolean;
  special: boolean;
  seq: number;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  team: Team;
  skin: FighterSkin;
  color: FighterColor;
  weapon: WeaponId;
  shield: ShieldId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  energy: number;
  facing: -1 | 1;
  grounded: boolean;
  action: FighterAction;
  wins: number;
}

export interface HitEvent {
  id: number;
  attackerId: string;
  targetId: string;
  x: number;
  y: number;
  kind: AttackKind;
  special: boolean;
  blocked: boolean;
}

export interface MatchSnapshot {
  roomCode: string;
  arena: ArenaTheme;
  status: MatchStatus;
  players: PlayerSnapshot[];
  round: number;
  timeLeft: number;
  countdown: number;
  winnerId?: string;
  roundWinnerId?: string;
  serverTime: number;
  hit?: HitEvent;
  campaign?: {
    missionId: number;
    act: string;
    title: string;
    objective: string;
    reward: number;
    completed: boolean;
  };
}

export interface JoinPayload {
  roomCode: string;
  name: string;
  team: Team;
  skin: FighterSkin;
  color: FighterColor;
  weapon: WeaponId;
  shield: ShieldId;
  arena: ArenaTheme;
}

export interface JoinResult {
  ok: boolean;
  message?: string;
  roomCode?: string;
}
