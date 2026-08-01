import { FIGHTERS } from './assets';
import { campaignMission } from './campaign';
import { FIGHTER_STATS, weaponProfile } from './combatBalance';
import type { GameClient } from './network';
import type {
  AttackKind,
  FighterAction,
  FighterSkin,
  HitEvent,
  JoinPayload,
  JoinResult,
  MatchSnapshot,
  MatchStatus,
  PlayerInput,
  PlayerSnapshot,
  ShieldId,
  Team,
  WeaponId,
} from './types';

export type CpuDifficulty = 'apprentice' | 'warrior' | 'nightmare';

type SnapshotListener = (snapshot: MatchSnapshot) => void;
type ConnectionListener = (connected: boolean) => void;

interface FighterState extends Omit<PlayerSnapshot, 'action'> {
  input: PlayerInput;
  jumpHeld: boolean;
  dashHeld: boolean;
  attackReadyAt: number;
  attackUntil: number;
  attackHitAt: number;
  attackResolved: boolean;
  attackKind: AttackKind | null;
  dashReadyAt: number;
  dashUntil: number;
  hurtUntil: number;
}

interface CpuProfile {
  reaction: number;
  aggression: number;
  guardChance: number;
  attackChance: number;
  mistakeChance: number;
}

const WORLD = { minX: 150, maxX: 2050, groundY: 690 };
const ROUND_DURATION = 60_000;
const LOCAL_ID = 'local-player';
const CPU_ID = 'riftfall-cpu';

const CPU_PROFILES: Record<CpuDifficulty, CpuProfile> = {
  apprentice: { reaction: 210, aggression: 0.58, guardChance: 0.18, attackChance: 0.52, mistakeChance: 0.24 },
  warrior: { reaction: 125, aggression: 0.78, guardChance: 0.42, attackChance: 0.76, mistakeChance: 0.1 },
  nightmare: { reaction: 75, aggression: 0.94, guardChance: 0.7, attackChance: 0.92, mistakeChance: 0.025 },
};

const emptyInput = (): PlayerInput => ({
  left: false,
  right: false,
  jump: false,
  attack: false,
  kick: false,
  dash: false,
  block: false,
  special: false,
  seq: 0,
});

const createFighter = (
  id: string,
  name: string,
  team: Team,
  skin: FighterSkin,
  weapon: WeaponId,
  shield: ShieldId,
  color: PlayerSnapshot['color'],
): FighterState => ({
  id,
  name,
  team,
  skin,
  color,
  weapon,
  shield,
  x: team === 'blue' ? 720 : 1480,
  y: WORLD.groundY,
  vx: 0,
  vy: 0,
  health: 100,
  energy: 0,
  facing: team === 'blue' ? 1 : -1,
  grounded: true,
  wins: 0,
  input: emptyInput(),
  jumpHeld: false,
  dashHeld: false,
  attackReadyAt: 0,
  attackUntil: 0,
  attackHitAt: 0,
  attackResolved: true,
  attackKind: null,
  dashReadyAt: 0,
  dashUntil: 0,
  hurtUntil: 0,
});

export class LocalCpuClient implements GameClient {
  readonly id = LOCAL_ID;
  private snapshotListeners = new Set<SnapshotListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private players: FighterState[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private arena: MatchSnapshot['arena'] = 'riftfall';
  private roomCode = 'TREINO OFFLINE';
  private status: MatchStatus = 'waiting';
  private round = 1;
  private countdownEndsAt = 0;
  private roundStartedAt = 0;
  private phaseEndsAt = 0;
  private winnerId?: string;
  private roundWinnerId?: string;
  private lastHit?: HitEvent;
  private hitCounter = 0;
  private snapshotCounter = 0;
  private previousTick = 0;
  private nextCpuDecisionAt = 0;
  private difficulty: CpuDifficulty = 'warrior';
  private campaignMode = false;
  private campaignMissionId = 1;
  private campaignCompleted = false;

  get connected(): boolean {
    return Boolean(this.interval);
  }

  setDifficulty(difficulty: CpuDifficulty): void {
    this.difficulty = difficulty;
  }

  setCampaign(missionId?: number): void {
    this.campaignMode = missionId !== undefined;
    this.campaignMissionId = missionId ?? 1;
    this.campaignCompleted = false;
    if (missionId !== undefined) this.difficulty = campaignMission(missionId).difficulty;
  }

  async join(payload: JoinPayload): Promise<JoinResult> {
    this.leave();
    const name = payload.name.trim().slice(0, 14);
    if (!name) return { ok: false, message: 'Escolha um nome para iniciar o treino.' };

    const cpuTeam: Team = payload.team === 'blue' ? 'red' : 'blue';
    const mission = campaignMission(this.campaignMissionId);
    const choices = (Object.keys(FIGHTERS) as FighterSkin[]).filter((skin) => skin !== payload.skin);
    const cpuSkin = this.campaignMode ? mission.enemySkin : (choices[Math.floor(Math.random() * choices.length)] ?? 'warrior');
    const cpuKit = FIGHTERS[cpuSkin];
    const cpuColors: PlayerSnapshot['color'][] = ['crimson', 'violet', 'gold', 'emerald', 'silver'];
    const cpuNames: Record<CpuDifficulty, string> = {
      apprentice: 'CPU APRENDIZ',
      warrior: 'CPU GUERREIRO',
      nightmare: 'CPU PESADELO',
    };

    this.players = [
      createFighter(LOCAL_ID, name, payload.team, payload.skin, payload.weapon, payload.shield, payload.color),
      createFighter(
        CPU_ID,
        this.campaignMode ? mission.enemyName : cpuNames[this.difficulty],
        cpuTeam,
        cpuSkin,
        this.campaignMode ? mission.enemyWeapon : cpuKit.defaultWeapon,
        this.campaignMode ? mission.enemyShield : cpuKit.defaultShield,
        cpuColors[Math.floor(Math.random() * cpuColors.length)] ?? 'crimson',
      ),
    ].sort((a, b) => a.team === 'blue' ? -1 : b.team === 'blue' ? 1 : 0);
    this.arena = this.campaignMode ? mission.arena : payload.arena;
    this.roomCode = this.campaignMode ? `CAMPANHA · MISSÃO ${mission.id}` : 'TREINO OFFLINE';
    this.round = 1;
    this.hitCounter = 0;
    this.lastHit = undefined;
    this.previousTick = Date.now();
    this.beginCountdown(this.previousTick);
    this.interval = setInterval(() => this.tick(), 1000 / 60);
    this.notifyConnection(true);
    this.emitSnapshot(this.previousTick);
    return { ok: true, roomCode: this.roomCode };
  }

  sendInput(input: PlayerInput): void {
    const player = this.players.find((fighter) => fighter.id === LOCAL_ID);
    if (!player || input.seq < player.input.seq) return;
    player.input = { ...input };
  }

  leave(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    this.players = [];
    this.status = 'waiting';
    this.notifyConnection(false);
  }

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);
    return () => this.connectionListeners.delete(listener);
  }

  private notifyConnection(connected: boolean): void {
    for (const listener of this.connectionListeners) listener(connected);
  }

  private beginCountdown(now: number): void {
    this.status = 'countdown';
    this.countdownEndsAt = now + 3_200;
    this.winnerId = undefined;
    this.roundWinnerId = undefined;
    this.resetPositions(false);
  }

  private resetPositions(restoreHealth = true): void {
    for (const player of this.players) {
      player.x = player.team === 'blue' ? 720 : 1480;
      player.y = WORLD.groundY;
      player.vx = 0;
      player.vy = 0;
      player.facing = player.team === 'blue' ? 1 : -1;
      player.grounded = true;
      player.input = emptyInput();
      player.jumpHeld = false;
      player.dashHeld = false;
      player.attackKind = null;
      player.attackResolved = true;
      player.attackUntil = 0;
      player.dashUntil = 0;
      player.hurtUntil = 0;
      player.energy = restoreHealth ? 0 : player.energy;
      if (restoreHealth) player.health = 100;
    }
  }

  private fighterAction(player: FighterState, now: number): FighterAction {
    if (player.health <= 0) return 'ko';
    if (player.hurtUntil > now) return 'hurt';
    if (player.attackUntil > now && player.attackKind) return player.attackKind;
    if (player.dashUntil > now) return 'dash';
    if (player.input.block && player.grounded) return 'block';
    if (!player.grounded) return 'jump';
    if (Math.abs(player.vx) > 35) return 'run';
    return 'idle';
  }

  private makeSnapshot(now: number): MatchSnapshot {
    return {
      roomCode: this.roomCode,
      arena: this.arena,
      status: this.status,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        skin: player.skin,
        color: player.color,
        weapon: player.weapon,
        shield: player.shield,
        x: Math.round(player.x * 10) / 10,
        y: Math.round(player.y * 10) / 10,
        vx: Math.round(player.vx),
        vy: Math.round(player.vy),
        health: Math.max(0, Math.round(player.health)),
        energy: Math.max(0, Math.min(100, Math.round(player.energy))),
        facing: player.facing,
        grounded: player.grounded,
        action: this.status === 'countdown'
          ? 'intro'
          : this.status === 'matchover' && this.winnerId === player.id
            ? 'victory'
            : this.fighterAction(player, now),
        wins: player.wins,
      })),
      round: this.round,
      timeLeft: this.status === 'fighting'
        ? Math.max(0, Math.ceil((ROUND_DURATION - (now - this.roundStartedAt)) / 1000))
        : 60,
      countdown: this.status === 'countdown'
        ? Math.max(0, Math.ceil((this.countdownEndsAt - now) / 1000))
        : 0,
      winnerId: this.winnerId,
      roundWinnerId: this.roundWinnerId,
      serverTime: now,
      hit: this.lastHit,
      campaign: this.campaignMode ? {
        missionId: campaignMission(this.campaignMissionId).id,
        act: campaignMission(this.campaignMissionId).act,
        title: campaignMission(this.campaignMissionId).title,
        objective: campaignMission(this.campaignMissionId).objective,
        reward: campaignMission(this.campaignMissionId).reward,
        completed: this.campaignCompleted,
      } : undefined,
    };
  }

  private emitSnapshot(now: number): void {
    const snapshot = this.makeSnapshot(now);
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  private updateCpu(now: number): void {
    if (now < this.nextCpuDecisionAt) return;
    const profile = CPU_PROFILES[this.difficulty];
    this.nextCpuDecisionAt = now + profile.reaction + Math.random() * profile.reaction * 0.6;
    const cpu = this.players.find((player) => player.id === CPU_ID);
    const target = this.players.find((player) => player.id === LOCAL_ID);
    if (!cpu || !target) return;

    const input = emptyInput();
    input.seq = cpu.input.seq + 1;
    if (this.status !== 'fighting' || cpu.health <= 0) {
      cpu.input = input;
      return;
    }

    const delta = target.x - cpu.x;
    const distance = Math.abs(delta);
    const direction = delta > 0 ? 'right' : 'left';
    const away = delta > 0 ? 'left' : 'right';
    const attackRange = weaponProfile(cpu.weapon).range;
    const targetThreat = target.attackUntil > now && distance < Math.max(460, weaponProfile(target.weapon).range);

    if (targetThreat && cpu.grounded && Math.random() < profile.guardChance) {
      input.block = true;
    } else if (cpu.energy >= 100 && distance < Math.max(520, attackRange * 1.1) && Math.random() < profile.attackChance) {
      input.special = true;
    } else if (distance <= attackRange * 0.92 && Math.random() < profile.attackChance) {
      if (distance < 350 && Math.random() < 0.32) input.kick = true;
      else input.attack = true;
    } else if (Math.random() < profile.mistakeChance) {
      input[away] = true;
    } else {
      input[direction] = true;
      if (distance > 760 && Math.random() < profile.aggression * 0.55) input.dash = true;
    }

    if (distance < 280 && !input.block && !input.attack && !input.kick && Math.random() > profile.aggression) {
      input.left = false;
      input.right = false;
      input[away] = true;
    }
    if (cpu.grounded && !input.block && Math.random() < 0.045 * (1 - profile.mistakeChance)) input.jump = true;
    cpu.input = input;
  }

  private startAttack(player: FighterState, kind: AttackKind, now: number): void {
    if (player.health <= 0 || player.hurtUntil > now || player.attackUntil > now || player.input.block) return;
    if (kind === 'special' && player.energy < 100) return;
    if (kind === 'special') {
      player.energy = 0;
      player.attackKind = 'special';
      player.attackHitAt = now + 260;
      player.attackUntil = now + 720;
      player.attackReadyAt = now + 980;
    } else if (kind === 'kick') {
      player.attackKind = 'kick';
      player.attackHitAt = now + 175;
      player.attackUntil = now + 480;
      player.attackReadyAt = now + 610;
    } else {
      const profile = weaponProfile(player.weapon);
      player.attackKind = 'attack';
      player.attackHitAt = now + profile.windup;
      player.attackUntil = now + profile.active;
      player.attackReadyAt = now + profile.recovery;
    }
    player.attackResolved = false;
    player.vx *= 0.25;
  }

  private resolveAttack(attacker: FighterState, now: number): void {
    if (attacker.attackResolved || !attacker.attackKind || attacker.attackHitAt > now) return;
    attacker.attackResolved = true;
    const target = this.players.find((candidate) => candidate.id !== attacker.id);
    if (!target || target.health <= 0) return;

    const kind = attacker.attackKind;
    const special = kind === 'special';
    const kick = kind === 'kick';
    const profile = weaponProfile(attacker.weapon);
    const distance = Math.abs(target.x - attacker.x);
    const verticalDistance = Math.abs(target.y - attacker.y);
    const inFront = (target.x - attacker.x) * attacker.facing > -25;
    const range = special ? Math.max(440, profile.range * 1.15) : kick ? 365 : profile.range;
    const verticalTolerance = kick ? 165 : profile.delivery === 'projectile' ? 230 : 145;
    if (distance > range || verticalDistance > verticalTolerance || !inFront) return;

    const targetFacingAttack = (attacker.x - target.x) * target.facing > 0;
    const blocked = target.input.block && target.grounded && targetFacingAttack;
    const attackerStats = FIGHTER_STATS[attacker.skin];
    const targetStats = FIGHTER_STATS[target.skin];
    const baseDamage = blocked ? (special ? 5 : kick ? 3 : 2) : (special ? 20 * profile.damage : kick ? 13 : 9 * profile.damage);
    const shieldDefense = target.shield === 'none' ? 1 : 0.88;
    const damage = Math.max(1, Math.round(baseDamage * attackerStats.damage * targetStats.defense * (blocked ? shieldDefense : 1)));
    const knockback = blocked ? (special ? 160 : kick ? 105 : 70) : (special ? 520 : kick ? 380 : profile.knockback);

    target.health = Math.max(0, target.health - damage);
    target.vx = attacker.facing * knockback;
    if (!blocked) {
      target.vy = special ? -330 : kick ? -220 : -130;
      target.grounded = false;
      target.hurtUntil = now + (special ? 430 : kick ? 335 : 260);
    }
    attacker.energy = Math.min(100, attacker.energy + (special ? 0 : kick ? 25 : 20) * attackerStats.energy);
    target.energy = Math.min(100, target.energy + (blocked ? 5 : 11));
    this.lastHit = {
      id: ++this.hitCounter,
      attackerId: attacker.id,
      targetId: target.id,
      x: (attacker.x + target.x) / 2,
      y: Math.min(attacker.y, target.y) - 105,
      kind,
      special,
      blocked,
    };
  }

  private simulateFighter(player: FighterState, opponent: FighterState, dt: number, now: number): void {
    const stats = FIGHTER_STATS[player.skin];
    if (Math.abs(opponent.y - player.y) < 120) player.facing = opponent.x >= player.x ? 1 : -1;
    const canDash = player.health > 0
      && player.grounded
      && player.hurtUntil <= now
      && player.attackUntil <= now
      && now >= player.dashReadyAt
      && !player.input.block;
    if (canDash && player.input.dash && !player.dashHeld) {
      player.dashUntil = now + 190;
      player.dashReadyAt = now + 850;
      const dashDirection = Number(player.input.right) - Number(player.input.left);
      player.vx = (dashDirection || player.facing) * 840 * stats.dash;
    }
    player.dashHeld = player.input.dash;

    const dashing = player.dashUntil > now;
    const canAct = player.health > 0 && player.hurtUntil <= now && player.attackUntil <= now && !dashing;
    const direction = canAct && !player.input.block ? Number(player.input.right) - Number(player.input.left) : 0;
    if (dashing) player.vx *= 0.985;
    else {
      const desiredVelocity = direction * (player.grounded ? 410 : 335) * stats.speed;
      player.vx += (desiredVelocity - player.vx) * (player.grounded ? 0.24 : 0.09);
      if (direction === 0 && player.grounded) player.vx *= 0.72;
    }

    if (canAct && player.input.jump && !player.jumpHeld && player.grounded && !player.input.block) {
      player.vy = -760 * stats.jump;
      player.grounded = false;
    }
    player.jumpHeld = player.input.jump;
    if (canAct && now >= player.attackReadyAt) {
      if (player.input.special) this.startAttack(player, 'special', now);
      else if (player.input.kick) this.startAttack(player, 'kick', now);
      else if (player.input.attack) this.startAttack(player, 'attack', now);
    }
    this.resolveAttack(player, now);
    player.vy += 1_900 * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.y >= WORLD.groundY) {
      player.y = WORLD.groundY;
      player.vy = 0;
      player.grounded = true;
    }
    player.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, player.x));
  }

  private separateFighters(): void {
    const [a, b] = this.players;
    if (!a || !b || Math.abs(a.y - b.y) > 110) return;
    const delta = b.x - a.x;
    const overlap = 340 - Math.abs(delta);
    if (overlap <= 0) return;
    const direction = delta >= 0 ? 1 : -1;
    a.x -= direction * overlap * 0.5;
    b.x += direction * overlap * 0.5;
  }

  private endRound(winner: FighterState | undefined, now: number): void {
    if (this.status !== 'fighting') return;
    if (winner) {
      winner.wins += 1;
      this.roundWinnerId = winner.id;
    } else this.roundWinnerId = undefined;

    const matchWinner = this.players.find((player) => player.wins >= 2);
    if (matchWinner) {
      this.status = 'matchover';
      this.winnerId = matchWinner.id;
      if (this.campaignMode && matchWinner.id === LOCAL_ID) {
        this.campaignCompleted = true;
        if (typeof localStorage !== 'undefined') {
          const unlocked = Math.max(Number(localStorage.getItem('riftfall-campaign-unlocked') || 1), Math.min(6, this.campaignMissionId + 1));
          localStorage.setItem('riftfall-campaign-unlocked', String(unlocked));
          const victories = Number(localStorage.getItem('riftfall-campaign-victories') || 0) + 1;
          localStorage.setItem('riftfall-campaign-victories', String(victories));
          const runes = Number(localStorage.getItem('riftfall-campaign-runes') || 0) + campaignMission(this.campaignMissionId).reward;
          localStorage.setItem('riftfall-campaign-runes', String(runes));
        }
      }
      this.phaseEndsAt = now + 6_000;
    } else {
      this.status = 'roundover';
      this.phaseEndsAt = now + 3_200;
    }
  }

  private tick(): void {
    const now = Date.now();
    const dt = Math.min(0.05, (now - this.previousTick) / 1000);
    this.previousTick = now;
    if (this.status === 'countdown' && now >= this.countdownEndsAt) {
      this.status = 'fighting';
      this.roundStartedAt = now;
    }
    if (this.status === 'fighting') {
      this.updateCpu(now);
      const [first, second] = this.players;
      if (first && second) {
        this.simulateFighter(first, second, dt, now);
        this.simulateFighter(second, first, dt, now);
        this.separateFighters();
        const alive = this.players.filter((player) => player.health > 0);
        if (alive.length < 2) this.endRound(alive.length === 1 ? alive[0] : undefined, now);
        else if (now - this.roundStartedAt >= ROUND_DURATION) {
          const winner = first.health === second.health ? undefined : first.health > second.health ? first : second;
          this.endRound(winner, now);
        }
      }
    } else if (this.status === 'roundover' && now >= this.phaseEndsAt) {
      this.round += 1;
      this.resetPositions();
      this.beginCountdown(now);
    } else if (this.status === 'matchover' && now >= this.phaseEndsAt && !this.campaignMode) {
      for (const player of this.players) player.wins = 0;
      this.round = 1;
      this.resetPositions();
      this.beginCountdown(now);
    }
    this.snapshotCounter += 1;
    if (this.snapshotCounter >= 3) {
      this.snapshotCounter = 0;
      this.emitSnapshot(now);
    }
  }
}
