import { io } from 'socket.io-client';
import { spawn } from 'node:child_process';

const testPort = 3187;
const endpoint = process.env.TEST_SERVER_URL || `http://localhost:${testPort}`;
const roomCode = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const ownedServer = process.env.TEST_SERVER_URL ? undefined : spawn(
  process.execPath,
  ['--import', 'tsx', 'server/index.ts'],
  { cwd: process.cwd(), env: { ...process.env, PORT: String(testPort), NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] },
);

if (ownedServer) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O servidor de teste não iniciou')), 6_000);
    ownedServer.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Riftfall server listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    ownedServer.stderr.on('data', (chunk) => {
      const message = String(chunk);
      if (message.includes('Error:')) {
        clearTimeout(timer);
        reject(new Error(message));
      }
    });
    ownedServer.once('exit', (code) => {
      if (code) reject(new Error(`Servidor de teste encerrou com código ${code}`));
    });
  });
}

const blue = io(endpoint, { transports: ['websocket'], autoConnect: false });
const red = io(endpoint, { transports: ['websocket'], autoConnect: false });
const snapshots = new Map();

function waitFor(socket, event, timeout = 6_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout esperando ${event}`)), timeout);
    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

function join(socket, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5_000).emit('joinMatch', payload, (error, result) => {
      if (error) reject(error);
      else if (!result.ok) reject(new Error(result.message));
      else resolve(result);
    });
  });
}

function waitForState(predicate, timeout = 8_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      for (const snapshot of snapshots.values()) {
        if (predicate(snapshot)) {
          clearInterval(timer);
          resolve(snapshot);
          return;
        }
      }
      if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error('Timeout esperando estado da partida'));
      }
    }, 30);
  });
}

function input(socket, partial, seq) {
  socket.emit('playerInput', {
    left: false,
    right: false,
    jump: false,
    attack: false,
    block: false,
    special: false,
    seq,
    ...partial,
  });
}

try {
  blue.connect();
  red.connect();
  await Promise.all([waitFor(blue, 'connect'), waitFor(red, 'connect')]);
  blue.on('snapshot', (snapshot) => snapshots.set('blue', snapshot));
  red.on('snapshot', (snapshot) => snapshots.set('red', snapshot));

  const healthResponse = await fetch(`${endpoint}/health`);
  const pageResponse = await fetch(`${endpoint}/`);
  if (!healthResponse.ok || !(await healthResponse.json()).ok) throw new Error('Health check falhou');
  if (!pageResponse.ok || !(await pageResponse.text()).includes('RIFTFALL')) throw new Error('Frontend de produção não foi servido');

  await join(blue, { roomCode, name: 'Azul Teste', team: 'blue' });
  const duplicateTeam = await new Promise((resolve, reject) => {
    red.timeout(5_000).emit('joinMatch', { roomCode, name: 'Azul Intruso', team: 'blue' }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
  if (duplicateTeam.ok || !duplicateTeam.message.includes('já foi escolhido')) throw new Error('Reserva de time não foi respeitada');
  await join(red, { roomCode, name: 'Vermelho Teste', team: 'red' });
  await waitForState((snapshot) => snapshot.status === 'fighting', 8_000);

  input(blue, { right: true }, 1);
  input(red, { left: true }, 1);
  await new Promise((resolve) => setTimeout(resolve, 850));
  input(blue, {}, 2);
  input(red, {}, 2);

  const approached = await waitForState((snapshot) => {
    const a = snapshot.players.find((player) => player.team === 'blue');
    const b = snapshot.players.find((player) => player.team === 'red');
    return a && b && Math.abs(a.x - b.x) < 180;
  }, 3_000);

  const redBefore = approached.players.find((player) => player.team === 'red').health;
  input(blue, { attack: true }, 3);
  await new Promise((resolve) => setTimeout(resolve, 180));
  input(blue, {}, 4);
  const hit = await waitForState((snapshot) => snapshot.players.find((player) => player.team === 'red')?.health < redBefore, 3_000);
  const redAfter = hit.players.find((player) => player.team === 'red').health;

  if (hit.players.length !== 2) throw new Error('A sala não manteve dois jogadores');
  if (redAfter >= redBefore) throw new Error('O golpe não causou dano');
  console.log(JSON.stringify({ ok: true, roomCode, status: hit.status, redBefore, redAfter, hitId: hit.hit?.id }, null, 2));
} finally {
  blue.emit('leaveMatch');
  red.emit('leaveMatch');
  blue.disconnect();
  red.disconnect();
  ownedServer?.kill('SIGTERM');
}
