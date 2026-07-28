import { io, type Socket } from 'socket.io-client';
import type { JoinPayload, JoinResult, MatchSnapshot, PlayerInput } from './types';

type SnapshotListener = (snapshot: MatchSnapshot) => void;
type ConnectionListener = (connected: boolean) => void;

export class NetworkClient {
  private readonly socket: Socket;
  private snapshotListeners = new Set<SnapshotListener>();
  private connectionListeners = new Set<ConnectionListener>();

  constructor() {
    this.socket = io({
      autoConnect: true,
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
      this.socket.timeout(6_000).emit('joinMatch', payload, (error: Error | null, result: JoinResult) => {
        if (error) resolve({ ok: false, message: 'O servidor da arena não respondeu. Tente novamente.' });
        else resolve(result);
      });
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
