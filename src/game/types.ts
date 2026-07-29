export type Team = 'blue' | 'red';
export type FighterSkin = 'vanguard' | 'ronin' | 'titan' | 'wraith';
export type FighterColor = 'azure' | 'crimson' | 'emerald' | 'violet' | 'gold' | 'fuchsia' | 'cyan' | 'lime' | 'orange' | 'ice' | 'coral' | 'silver';
export type ArenaTheme = 'riftfall' | 'ember' | 'neon' | 'astral';
export type AttackKind = 'attack' | 'kick' | 'special';
export type FighterAction = 'idle' | 'run' | 'dash' | 'jump' | AttackKind | 'block' | 'hurt' | 'ko';
export type MatchStatus = 'waiting' | 'countdown' | 'fighting' | 'roundover' | 'matchover';

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
}

export interface JoinPayload {
  roomCode: string;
  name: string;
  team: Team;
  skin: FighterSkin;
  color: FighterColor;
  arena: ArenaTheme;
}

export interface JoinResult {
  ok: boolean;
  message?: string;
  roomCode?: string;
}
