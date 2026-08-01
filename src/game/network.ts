import { io, type Socket } from 'socket.io-client';
import type { ArenaTheme, FighterColor, FighterSkin, JoinPayload, JoinResult, MatchSnapshot, PlayerInput, ShieldId, WeaponId } from './types';
import { SHIELD_IDS, WEAPON_IDS } from './types';

type SnapshotListener = (snapshot: MatchSnapshot) => void;
type ConnectionListener = (connected: boolean) => void;

const FIGHTER_SKINS: FighterSkin[] = [
  'mage', 'minion', 'rogue', 'warrior', 'barbarian', 'knight',
  'adventurerMage', 'ranger', 'adventurerRogue', 'hoodedRogue',
  'mannequinMedium', 'mannequinLarge',
];
const FIGHTER_COLORS: FighterColor[] = [
  'azure', 'crimson', 'emerald', 'violet', 'gold', 'fuchsia',
  'cyan', 'lime', 'orange', 'ice', 'coral', 'silver',
];
const ARENAS: ArenaTheme[] = ['riftfall', 'ember', 'neon', 'astral'];
const COMPAT_MARKER = '\uE100';
const COMPAT_BASE = 0xE000;

interface CompatLoadout {
  name: string;
  skin: FighterSkin;
  color: FighterColor;
  weapon: WeaponId;
  shield: ShieldId;
  arena: ArenaTheme;
}

export function encodeCompatLoadout(payload: JoinPayload): string {
  let bits = FIGHTER_SKINS.indexOf(payload.skin);
  bits |= WEAPON_IDS.indexOf(payload.weapon) << 4;
  bits |= SHIELD_IDS.indexOf(payload.shield) << 10;
  bits |= FIGHTER_COLORS.indexOf(payload.color) << 15;
  bits |= ARENAS.indexOf(payload.arena) << 19;
  const signature = [0, 7, 14].map((shift) => String.fromCharCode(COMPAT_BASE + ((bits >> shift) & 0x7f))).join('');
  return `${Array.from(payload.name).slice(0, 10).join('')}${COMPAT_MARKER}${signature}`;
}

export function decodeCompatLoadout(value: string): CompatLoadout | undefined {
  const marker = value.indexOf(COMPAT_MARKER);
  if (marker < 0 || value.length < marker + 4) return undefined;
  const encoded = [...value.slice(marker + 1, marker + 4)].map((char) => char.charCodeAt(0) - COMPAT_BASE);
  if (encoded.some((part) => part < 0 || part > 0x7f)) return undefined;
  const bits = encoded[0] | (encoded[1] << 7) | (encoded[2] << 14);
  const skin = FIGHTER_SKINS[bits & 0xf];
  const weapon = WEAPON_IDS[(bits >> 4) & 0x3f];
  const shield = SHIELD_IDS[(bits >> 10) & 0x1f];
  const color = FIGHTER_COLORS[(bits >> 15) & 0xf];
  const arena = ARENAS[(bits >> 19) & 0x3];
  if (!skin || !weapon || !shield || !color || !arena) return undefined;
  return { name: value.slice(0, marker), skin, weapon, shield, color, arena };
}

export function restoreCompatSnapshot(snapshot: MatchSnapshot): MatchSnapshot {
  const decodedPlayers = snapshot.players.map((player) => {
    const loadout = decodeCompatLoadout(player.name);
    return loadout ? { ...player, ...loadout, arena: undefined } : player;
  });
  const roomOwner = snapshot.players.map((player) => decodeCompatLoadout(player.name)).find(Boolean);
  return { ...snapshot, arena: roomOwner?.arena ?? snapshot.arena, players: decodedPlayers };
}

export interface GameClient {
  readonly id: string | undefined;
  readonly connected: boolean;
  join(payload: JoinPayload): Promise<JoinResult>;
  sendInput(input: PlayerInput): void;
  leave(): void;
  onSnapshot(listener: SnapshotListener): () => void;
  onConnection(listener: ConnectionListener): () => void;
}

export class NetworkClient implements GameClient {
  private readonly socket: Socket;
  private snapshotListeners = new Set<SnapshotListener>();
  private connectionListeners = new Set<ConnectionListener>();

  constructor() {
    const configuredEndpoint = String(import.meta.env.VITE_MULTIPLAYER_URL || '').trim();
    const endpoint = configuredEndpoint || (import.meta.env.DEV ? undefined : 'https://riftfall-duel.onrender.com');

    this.socket = io(endpoint, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelayMax: 2_000,
    });

    this.socket.on('snapshot', (snapshot: MatchSnapshot) => {
      const restored = restoreCompatSnapshot(snapshot);
      for (const listener of this.snapshotListeners) listener(restored);
    });
    this.socket.on('connect', () => this.notifyConnection(true));
    this.socket.on('disconnect', () => this.notifyConnection(false));
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  join(payload: JoinPayload): Promise<JoinResult> {
    return new Promise((resolve) => {
      const submit = () => {
        const emitJoin = (joinPayload: JoinPayload, allowCompat: boolean) => {
          this.socket.timeout(8_000).emit('joinMatch', joinPayload, (error: Error | null, result: JoinResult) => {
            if (error) {
              resolve({ ok: false, message: 'O servidor da arena não respondeu. Tente novamente.' });
              return;
            }
            const oldServerRejection = !result.ok
              && result.message === 'Confira seu nome, o nome da sala e as opções de personalização.';
            if (allowCompat && oldServerRejection) {
              emitJoin({
                ...joinPayload,
                name: encodeCompatLoadout(joinPayload),
                skin: 'mage',
                color: 'azure',
                weapon: 'Skeleton_Staff',
                shield: 'none',
                arena: 'riftfall',
              }, false);
              return;
            }
            resolve(result);
          });
        };
        emitJoin(payload, true);
      };
      if (this.socket.connected) submit();
      else {
        this.socket.connect();
        this.socket.once('connect', submit);
        this.socket.once('connect_error', () => {
          resolve({ ok: false, message: 'A arena online está indisponível. O modo Contra CPU funciona sem internet.' });
        });
      }
    });
  }

  sendInput(input: PlayerInput): void {
    if (this.socket.connected) this.socket.emit('playerInput', input);
  }

  leave(): void {
    this.socket.emit('leaveMatch');
  }

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.socket.connected);
    return () => this.connectionListeners.delete(listener);
  }

  private notifyConnection(connected: boolean): void {
    for (const listener of this.connectionListeners) listener(connected);
  }
}
