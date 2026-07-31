import { LocalCpuClient } from '../src/game/localCpu.ts';
import type { MatchSnapshot, PlayerInput } from '../src/game/types.ts';

const cpu = new LocalCpuClient();
cpu.setDifficulty('nightmare');
let latest: MatchSnapshot | undefined;
let snapshots = 0;
let sequence = 0;
const unsubscribe = cpu.onSnapshot((snapshot) => {
  latest = snapshot;
  snapshots += 1;
});

const send = (partial: Partial<PlayerInput>) => {
  cpu.sendInput({
    left: false,
    right: false,
    jump: false,
    attack: false,
    kick: false,
    dash: false,
    block: false,
    special: false,
    seq: ++sequence,
    ...partial,
  });
};

const waitFor = async (predicate: () => boolean, timeout: number, label: string) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timeout esperando ${label}`);
};

try {
  const result = await cpu.join({
    roomCode: 'ignorado',
    name: 'Teste Local',
    team: 'blue',
    skin: 'rogue',
    color: 'emerald',
    weapon: 'dagger_B',
    shield: 'none',
    arena: 'astral',
  });
  if (!result.ok) throw new Error(result.message);
  await waitFor(() => latest?.status === 'fighting', 5_000, 'início da luta');
  if (latest?.players.length !== 2) throw new Error('O modo CPU não criou dois lutadores');
  if (!latest.players.some((player) => player.id === 'riftfall-cpu')) throw new Error('Adversário CPU ausente');
  if (latest.arena !== 'astral') throw new Error('Arena escolhida não foi preservada');

  send({ right: true, dash: true });
  await new Promise((resolve) => setTimeout(resolve, 700));
  send({ right: true });
  await new Promise((resolve) => setTimeout(resolve, 500));
  send({ attack: true });
  await new Promise((resolve) => setTimeout(resolve, 220));
  send({});

  await waitFor(
    () => Boolean(latest?.hit || latest?.players.some((player) => player.health < 100)),
    5_000,
    'primeiro golpe local ou da CPU',
  );
  console.log(JSON.stringify({
    ok: true,
    status: latest?.status,
    snapshots,
    players: latest?.players.map((player) => ({
      id: player.id,
      health: player.health,
      action: player.action,
      weapon: player.weapon,
    })),
    hit: latest?.hit?.kind,
  }, null, 2));
} finally {
  unsubscribe();
  cpu.leave();
}
