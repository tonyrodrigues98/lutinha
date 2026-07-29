import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from 'socket.io';
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
  Team,
} from '../src/game/types.js';

const PORT = Number(process.env.PORT || 3001);
const WORLD = { minX: 150, maxX: 2050, groundY: 690 };
const ROUND_DURATION = 60_000;
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;

const FIGHTER_STATS: Record<FighterSkin, {
  speed: number;
  jump: number;
  dash: number;
  damage: number;
  defense: number;
  energy: number;
}> = {
  vanguard: { speed: 1, jump: 1, dash: 1, damage: 1, defense: 1, energy: 1 },
  ronin: { speed: 1.13, jump: 1.09, dash: 1.05, damage: 0.93, defense: 1.06, energy: 1.05 },
  titan: { speed: 0.86, jump: 0.9, dash: 0.88, damage: 1.18, defense: 0.88, energy: 0.9 },
  wraith: { speed: 1.06, jump: 1.03, dash: 1.2, damage: 0.97, defense: 1.03, energy: 1.2 },
};

interface FighterState {
  id: string;
  name: string;
  team: Team;
  skin: FighterSkin;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  energy: number;
  facing: -1 | 1;
  grounded: boolean;
  wins: number;
  input: PlayerInput;
  jumpHeld: boolean;
  attackReadyAt: number;
  attackUntil: number;
  attackHitAt: number;
  attackResolved: boolean;
  attackKind: AttackKind | null;
  dashReadyAt: number;
  dashUntil: number;
  dashHeld: boolean;
  hurtUntil: number;
}

interface RoomState {
  code: string;
  players: Map<string, FighterState>;
  status: MatchStatus;
  round: number;
  countdownEndsAt: number;
  roundStartedAt: number;
  phaseEndsAt: number;
  winnerId?: string;
  roundWinnerId?: string;
  lastHit?: HitEvent;
  hitCounter: number;
  snapshotCounter: number;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
});
const rooms = new Map<string, RoomState>();

app.get('/health', (_request, response) => {
  response.json({ ok: true, rooms: rooms.size, players: io.engine.clientsCount });
});

const distPath = join(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*splat', (_request, response) => response.sendFile(join(distPath, 'index.html')));
}

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

const createRoom = (code: string): RoomState => ({
  code,
  players: new Map(),
  status: 'waiting',
  round: 1,
  countdownEndsAt: 0,
  roundStartedAt: 0,
  phaseEndsAt: 0,
  hitCounter: 0,
  snapshotCounter: 0,
});

const createFighter = (id: string, name: string, team: Team, skin: FighterSkin): FighterState => ({
  id,
  name,
  team,
  skin,
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
  attackReadyAt: 0,
  attackUntil: 0,
  attackHitAt: 0,
  attackResolved: true,
  attackKind: null,
  dashReadyAt: 0,
  dashUntil: 0,
  dashHeld: false,
  hurtUntil: 0,
});

const cleanCode = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanName = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 14);
const cleanSkin = (value: unknown): FighterSkin | undefined => (
  ['vanguard', 'ronin', 'titan', 'wraith'] as FighterSkin[]
).find((skin) => skin === value);

function beginCountdown(room: RoomState, now = Date.now()): void {
  room.status = 'countdown';
  room.countdownEndsAt = now + 3_200;
  room.winnerId = undefined;
  room.roundWinnerId = undefined;
  resetPositions(room, false);
}

function resetPositions(room: RoomState, restoreHealth = true): void {
  for (const player of room.players.values()) {
    player.x = player.team === 'blue' ? 720 : 1480;
    player.y = WORLD.groundY;
    player.vx = 0;
    player.vy = 0;
    player.facing = player.team === 'blue' ? 1 : -1;
    player.grounded = true;
    player.input = emptyInput();
    player.jumpHeld = false;
    player.attackKind = null;
    player.attackResolved = true;
    player.attackUntil = 0;
    player.dashUntil = 0;
    player.dashHeld = false;
    player.hurtUntil = 0;
    if (restoreHealth) player.health = 100;
  }
}

function fighterAction(player: FighterState, now: number): FighterAction {
  if (player.health <= 0) return 'ko';
  if (player.hurtUntil > now) return 'hurt';
  if (player.attackUntil > now && player.attackKind) return player.attackKind;
  if (player.dashUntil > now) return 'dash';
  if (player.input.block && player.grounded) return 'block';
  if (!player.grounded) return 'jump';
  if (Math.abs(player.vx) > 35) return 'run';
  return 'idle';
}

function makeSnapshot(room: RoomState, now: number): MatchSnapshot {
  const players: PlayerSnapshot[] = [...room.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    team: player.team,
    skin: player.skin,
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    vx: Math.round(player.vx),
    vy: Math.round(player.vy),
    health: Math.max(0, Math.round(player.health)),
    energy: Math.max(0, Math.min(100, Math.round(player.energy))),
    facing: player.facing,
    grounded: player.grounded,
    action: fighterAction(player, now),
    wins: player.wins,
  }));

  const timeLeft = room.status === 'fighting'
    ? Math.max(0, Math.ceil((ROUND_DURATION - (now - room.roundStartedAt)) / 1000))
    : 60;
  const countdown = room.status === 'countdown'
    ? Math.max(0, Math.ceil((room.countdownEndsAt - now) / 1000))
    : 0;

  return {
    roomCode: room.code,
    status: room.status,
    players,
    round: room.round,
    timeLeft,
    countdown,
    winnerId: room.winnerId,
    roundWinnerId: room.roundWinnerId,
    serverTime: now,
    hit: room.lastHit,
  };
}

function emitRoom(room: RoomState, now = Date.now()): void {
  io.to(room.code).emit('snapshot', makeSnapshot(room, now));
}

function startAttack(player: FighterState, kind: AttackKind, now: number): void {
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
    player.attackKind = 'attack';
    player.attackHitAt = now + 120;
    player.attackUntil = now + 360;
    player.attackReadyAt = now + 440;
  }
  player.attackResolved = false;
  player.vx *= 0.25;
}

function resolveAttack(room: RoomState, attacker: FighterState, now: number): void {
  if (attacker.attackResolved || !attacker.attackKind || attacker.attackHitAt > now) return;
  attacker.attackResolved = true;

  const target = [...room.players.values()].find((candidate) => candidate.id !== attacker.id);
  if (!target || target.health <= 0) return;
  const kind = attacker.attackKind;
  const special = kind === 'special';
  const kick = kind === 'kick';
  const distance = Math.abs(target.x - attacker.x);
  const verticalDistance = Math.abs(target.y - attacker.y);
  const inFront = (target.x - attacker.x) * attacker.facing > -25;
  const range = special ? 245 : kick ? 188 : 158;
  if (distance > range || verticalDistance > (kick ? 165 : 145) || !inFront) return;

  const targetFacingAttack = (attacker.x - target.x) * target.facing > 0;
  const blocked = target.input.block && target.grounded && targetFacingAttack;
  const attackerStats = FIGHTER_STATS[attacker.skin];
  const targetStats = FIGHTER_STATS[target.skin];
  const baseDamage = blocked ? (special ? 5 : kick ? 3 : 2) : (special ? 20 : kick ? 13 : 9);
  const damage = Math.max(1, Math.round(baseDamage * attackerStats.damage * targetStats.defense));
  const knockback = blocked ? (special ? 160 : kick ? 105 : 70) : (special ? 520 : kick ? 380 : 280);

  target.health = Math.max(0, target.health - damage);
  target.vx = attacker.facing * knockback;
  if (!blocked) {
    target.vy = special ? -330 : kick ? -220 : -130;
    target.grounded = false;
    target.hurtUntil = now + (special ? 430 : kick ? 335 : 260);
  }
  attacker.energy = Math.min(100, attacker.energy + (special ? 0 : kick ? 25 : 20) * attackerStats.energy);
  target.energy = Math.min(100, target.energy + (blocked ? 5 : 11));

  room.lastHit = {
    id: ++room.hitCounter,
    attackerId: attacker.id,
    targetId: target.id,
    x: (attacker.x + target.x) / 2,
    y: Math.min(attacker.y, target.y) - 105,
    kind,
    special,
    blocked,
  };
}

function simulateFighter(player: FighterState, opponent: FighterState | undefined, room: RoomState, dt: number, now: number): void {
  const stats = FIGHTER_STATS[player.skin];
  if (opponent && Math.abs(opponent.y - player.y) < 120) {
    player.facing = opponent.x >= player.x ? 1 : -1;
  }

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
  if (dashing) {
    player.vx *= 0.985;
  } else {
    const desiredVelocity = direction * (player.grounded ? 410 : 335) * stats.speed;
    const responsiveness = player.grounded ? 0.24 : 0.09;
    player.vx += (desiredVelocity - player.vx) * responsiveness;
    if (direction === 0 && player.grounded) player.vx *= 0.72;
  }

  if (canAct && player.input.jump && !player.jumpHeld && player.grounded && !player.input.block) {
    player.vy = -760 * stats.jump;
    player.grounded = false;
  }
  player.jumpHeld = player.input.jump;

  if (canAct && now >= player.attackReadyAt) {
    if (player.input.special) startAttack(player, 'special', now);
    else if (player.input.kick) startAttack(player, 'kick', now);
    else if (player.input.attack) startAttack(player, 'attack', now);
  }

  resolveAttack(room, player, now);
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

function separateFighters(players: FighterState[]): void {
  if (players.length !== 2) return;
  const [a, b] = players;
  if (Math.abs(a.y - b.y) > 110) return;
  const delta = b.x - a.x;
  const overlap = 82 - Math.abs(delta);
  if (overlap <= 0) return;
  const direction = delta >= 0 ? 1 : -1;
  a.x -= direction * overlap * 0.5;
  b.x += direction * overlap * 0.5;
}

function endRound(room: RoomState, winner: FighterState | undefined, now: number): void {
  if (room.status !== 'fighting') return;
  if (winner) {
    winner.wins += 1;
    room.roundWinnerId = winner.id;
  } else {
    room.roundWinnerId = undefined;
  }

  const matchWinner = [...room.players.values()].find((player) => player.wins >= 2);
  if (matchWinner) {
    room.status = 'matchover';
    room.winnerId = matchWinner.id;
    room.phaseEndsAt = now + 6_000;
  } else {
    room.status = 'roundover';
    room.phaseEndsAt = now + 3_200;
  }
}

function tickRoom(room: RoomState, dt: number, now: number): void {
  if (room.players.size < 2) {
    room.status = 'waiting';
    return;
  }

  if (room.status === 'countdown' && now >= room.countdownEndsAt) {
    room.status = 'fighting';
    room.roundStartedAt = now;
  }

  if (room.status === 'fighting') {
    const players = [...room.players.values()];
    simulateFighter(players[0], players[1], room, dt, now);
    simulateFighter(players[1], players[0], room, dt, now);
    separateFighters(players);

    const alive = players.filter((player) => player.health > 0);
    if (alive.length < 2) endRound(room, alive.length === 1 ? alive[0] : undefined, now);
    else if (now - room.roundStartedAt >= ROUND_DURATION) {
      const winner = players[0].health === players[1].health
        ? undefined
        : players[0].health > players[1].health ? players[0] : players[1];
      endRound(room, winner, now);
    }
  } else if (room.status === 'roundover' && now >= room.phaseEndsAt) {
    room.round += 1;
    resetPositions(room);
    beginCountdown(room, now);
  } else if (room.status === 'matchover' && now >= room.phaseEndsAt) {
    for (const player of room.players.values()) player.wins = 0;
    room.round = 1;
    resetPositions(room);
    beginCountdown(room, now);
  }

  room.snapshotCounter += 1;
  if (room.snapshotCounter >= TICK_RATE / SNAPSHOT_RATE) {
    room.snapshotCounter = 0;
    emitRoom(room, now);
  }
}

function leaveCurrentRoom(socketId: string, roomCode?: string): void {
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  room.players.delete(socketId);
  room.status = 'waiting';
  room.round = 1;
  room.winnerId = undefined;
  room.roundWinnerId = undefined;
  for (const player of room.players.values()) {
    player.wins = 0;
    player.health = 100;
    player.energy = 0;
  }
  if (room.players.size === 0) rooms.delete(roomCode);
  else emitRoom(room);
}

io.on('connection', (socket) => {
  socket.on('joinMatch', (rawPayload: JoinPayload, acknowledge: (result: JoinResult) => void) => {
    const roomCode = cleanCode(rawPayload?.roomCode);
    const name = cleanName(rawPayload?.name);
    const team = rawPayload?.team;
    const skin = cleanSkin(rawPayload?.skin);

    if (roomCode.length < 4 || !name || !skin || (team !== 'blue' && team !== 'red')) {
      acknowledge({ ok: false, message: 'Confira o nome, o código, o time e o personagem escolhido.' });
      return;
    }

    const previousRoom = socket.data.roomCode as string | undefined;
    if (previousRoom) {
      socket.leave(previousRoom);
      leaveCurrentRoom(socket.id, previousRoom);
    }

    const room = rooms.get(roomCode) ?? createRoom(roomCode);
    if (room.players.size >= 2) {
      acknowledge({ ok: false, message: 'Esta arena já está completa.' });
      return;
    }
    if ([...room.players.values()].some((player) => player.team === team)) {
      acknowledge({ ok: false, message: `O time ${team === 'blue' ? 'azul' : 'vermelho'} já foi escolhido pelo rival.` });
      return;
    }

    rooms.set(roomCode, room);
    room.players.set(socket.id, createFighter(socket.id, name, team, skin));
    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    acknowledge({ ok: true, roomCode });

    if (room.players.size === 2) beginCountdown(room);
    emitRoom(room);
  });

  socket.on('playerInput', (input: PlayerInput) => {
    const roomCode = socket.data.roomCode as string | undefined;
    const player = roomCode ? rooms.get(roomCode)?.players.get(socket.id) : undefined;
    if (!player || !input || input.seq < player.input.seq) return;
    player.input = {
      left: Boolean(input.left),
      right: Boolean(input.right),
      jump: Boolean(input.jump),
      attack: Boolean(input.attack),
      kick: Boolean(input.kick),
      dash: Boolean(input.dash),
      block: Boolean(input.block),
      special: Boolean(input.special),
      seq: Number.isFinite(input.seq) ? input.seq : player.input.seq,
    };
  });

  socket.on('leaveMatch', () => {
    const roomCode = socket.data.roomCode as string | undefined;
    if (roomCode) socket.leave(roomCode);
    leaveCurrentRoom(socket.id, roomCode);
    socket.data.roomCode = undefined;
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket.id, socket.data.roomCode as string | undefined);
  });
});

let previousTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.05, (now - previousTick) / 1000);
  previousTick = now;
  for (const room of rooms.values()) tickRoom(room, dt, now);
}, 1000 / TICK_RATE);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Riftfall server listening on http://localhost:${PORT}`);
});
