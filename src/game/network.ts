import { io, type Socket } from 'socket.io-client';
import type { JoinPayload, JoinResult, MatchSnapshot, PlayerInput } from './types';

type SnapshotListener = (snapshot: MatchSnapshot) => void;
type ConnectionListener = (connected: boolean) => void;

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
      for (const listener of this.snapshotListeners) listener(snapshot);
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
        this.socket.timeout(8_000).emit('joinMatch', payload, (error: Error | null, result: JoinResult) => {
          if (error) resolve({ ok: false, message: 'O servidor da arena não respondeu. Tente novamente.' });
          else resolve(result);
        });
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
