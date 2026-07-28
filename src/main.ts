import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import Phaser from 'phaser';
import { FightScene } from './game/FightScene';
import { NetworkClient } from './game/network';
import type { HitEvent, MatchSnapshot, PlayerInput, PlayerSnapshot, Team } from './game/types';

const network = new NetworkClient();
let selectedTeam: Team = 'blue';
let game: Phaser.Game | undefined;
let latestSnapshot: MatchSnapshot | undefined;
let inputSequence = 0;
let lastAudioHit = 0;

// Safari on iPhone may still zoom despite the viewport directive.
// Block pinch, double-tap and browser gesture events throughout the game.
const preventBrowserZoom = (): void => {
  const cancel = (event: Event) => event.preventDefault();
  document.addEventListener('gesturestart', cancel, { passive: false });
  document.addEventListener('gesturechange', cancel, { passive: false });
  document.addEventListener('gestureend', cancel, { passive: false });
  document.addEventListener('dblclick', cancel, { passive: false });
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
};

preventBrowserZoom();

const input: PlayerInput = {
  left: false,
  right: false,
  jump: false,
  attack: false,
  block: false,
  special: false,
  seq: 0,
};

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
  return element;
};

const lobby = $('#lobby');
const gameShell = $('#game-shell');
const joinForm = $('#join-form') as HTMLFormElement;
const joinButton = $('#join-button') as HTMLButtonElement;
const nameInput = $('#player-name') as HTMLInputElement;
const roomInput = $('#room-code') as HTMLInputElement;
const lobbyError = $('#lobby-error');
const banner = $('#match-banner');
const bannerKicker = $('#banner-kicker');
const bannerTitle = $('#banner-title');
const shareButton = $('#share-match') as HTMLButtonElement;
const connectionState = $('#connection-state');
const specialButton = $('#special-button') as HTMLButtonElement;

const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(): string {
  const values = new Uint32Array(5);
  crypto.getRandomValues(values);
  return [...values].map((value) => roomAlphabet[value % roomAlphabet.length]).join('');
}

const queryRoom = new URLSearchParams(location.search).get('room');
roomInput.value = (queryRoom?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || generateRoomCode());
nameInput.value = localStorage.getItem('riftfall-player-name') || '';

document.querySelectorAll<HTMLButtonElement>('.team-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedTeam = button.dataset.team as Team;
    document.querySelectorAll<HTMLButtonElement>('.team-choice').forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });
});

$('#new-room').addEventListener('click', () => {
  roomInput.value = generateRoomCode();
  lobbyError.textContent = '';
});

roomInput.addEventListener('input', () => {
  roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  lobbyError.textContent = '';
  joinButton.disabled = true;
  joinButton.querySelector('span')!.textContent = 'CONECTANDO...';

  const name = nameInput.value.trim();
  const roomCode = roomInput.value.trim().toUpperCase();
  const result = await network.join({ name, roomCode, team: selectedTeam });
  if (!result.ok) {
    lobbyError.textContent = result.message || 'Não foi possível entrar na arena.';
    joinButton.disabled = false;
    joinButton.querySelector('span')!.textContent = 'ENTRAR NA ARENA';
    return;
  }

  localStorage.setItem('riftfall-player-name', name);
  history.replaceState(null, '', `${location.pathname}?room=${result.roomCode}`);
  lobby.classList.add('hidden');
  gameShell.classList.remove('hidden');
  startGame();
  window.setTimeout(() => game?.scale.resize(window.innerWidth, window.innerHeight), 80);
});

function startGame(): void {
  if (game) return;
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-canvas',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#071020',
    transparent: false,
    antialias: true,
    render: { pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new FightScene(network)],
    input: { activePointers: 6 },
  });
}

function sendInput(): void {
  input.seq = ++inputSequence;
  network.sendInput(input);
}

function setInput(action: keyof Omit<PlayerInput, 'seq'>, active: boolean): void {
  if (input[action] === active) return;
  input[action] = active;
  sendInput();
}

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
  const action = button.dataset.action as keyof Omit<PlayerInput, 'seq'>;
  const release = (event: PointerEvent) => {
    event.preventDefault();
    setInput(action, false);
    button.classList.remove('pressed');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setInput(action, true);
    button.classList.add('pressed');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
});

const keyboardMap: Record<string, keyof Omit<PlayerInput, 'seq'>> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyJ: 'attack', KeyK: 'block', KeyL: 'special',
};
window.addEventListener('keydown', (event) => {
  const action = keyboardMap[event.code];
  if (action && !event.repeat) {
    event.preventDefault();
    setInput(action, true);
  }
});
window.addEventListener('keyup', (event) => {
  const action = keyboardMap[event.code];
  if (action) {
    event.preventDefault();
    setInput(action, false);
  }
});
window.addEventListener('blur', () => {
  (Object.keys(input) as Array<keyof PlayerInput>).forEach((key) => {
    if (key !== 'seq') input[key] = false;
  });
  sendInput();
});
window.setInterval(() => {
  if (!gameShell.classList.contains('hidden')) sendInput();
}, 50);

network.onSnapshot((snapshot) => {
  latestSnapshot = snapshot;
  updateHud(snapshot);
  if (snapshot.hit && snapshot.hit.id !== lastAudioHit) {
    lastAudioHit = snapshot.hit.id;
    playImpactSound(snapshot.hit);
  }
});

network.onConnection((connected) => {
  connectionState.classList.toggle('visible', !connected && !gameShell.classList.contains('hidden'));
});

function findTeam(snapshot: MatchSnapshot, team: Team): PlayerSnapshot | undefined {
  return snapshot.players.find((player) => player.team === team);
}

function updateFighterHud(team: Team, player?: PlayerSnapshot): void {
  $(`#${team}-name`).textContent = player?.name.toUpperCase() || 'AGUARDANDO';
  const health = $(`#${team}-health`);
  health.style.width = `${player?.health ?? 0}%`;
  health.classList.toggle('critical', Boolean(player && player.health <= 25));
  $(`#${team}-energy`).textContent = `ENERGIA ${player?.energy ?? 0}%`;
  const wins = $(`#${team}-wins`);
  wins.innerHTML = '<i></i><i></i>';
  [...wins.children].forEach((pip, index) => pip.classList.toggle('won', index < (player?.wins ?? 0)));
}

function updateHud(snapshot: MatchSnapshot): void {
  const blue = findTeam(snapshot, 'blue');
  const red = findTeam(snapshot, 'red');
  const local = snapshot.players.find((player) => player.id === network.id);
  updateFighterHud('blue', blue);
  updateFighterHud('red', red);
  $('#round-label').textContent = `RODADA ${snapshot.round}`;
  $('#round-timer').textContent = String(snapshot.timeLeft).padStart(2, '0');
  specialButton.classList.toggle('ready', Boolean(local && local.energy >= 100));

  if (snapshot.status === 'waiting') {
    banner.classList.add('visible');
    bannerKicker.textContent = `ARENA ${snapshot.roomCode}`;
    bannerTitle.textContent = 'AGUARDANDO RIVAL';
    shareButton.classList.remove('hidden');
  } else if (snapshot.status === 'countdown') {
    banner.classList.add('visible', 'counting');
    bannerKicker.textContent = `RODADA ${snapshot.round}`;
    bannerTitle.textContent = snapshot.countdown > 0 ? String(snapshot.countdown) : 'LUTE';
    shareButton.classList.add('hidden');
  } else if (snapshot.status === 'fighting') {
    banner.classList.remove('visible', 'counting');
  } else if (snapshot.status === 'roundover') {
    const winner = snapshot.players.find((player) => player.id === snapshot.roundWinnerId);
    banner.classList.add('visible');
    bannerKicker.textContent = `FIM DA RODADA ${snapshot.round}`;
    bannerTitle.textContent = winner ? `${winner.name.toUpperCase()} VENCEU` : 'EMPATE';
    shareButton.classList.add('hidden');
  } else if (snapshot.status === 'matchover') {
    const winner = snapshot.players.find((player) => player.id === snapshot.winnerId);
    banner.classList.add('visible');
    bannerKicker.textContent = 'CAMPEÃO DA FENDA';
    bannerTitle.textContent = winner?.name.toUpperCase() || 'FIM DA LUTA';
    shareButton.classList.add('hidden');
  }
}

shareButton.addEventListener('click', async () => {
  const roomCode = latestSnapshot?.roomCode || roomInput.value;
  const invite = `${location.origin}${location.pathname}?room=${roomCode}`;
  const shareData = { title: 'Riftfall Duel', text: `Entre na arena ${roomCode} e lute comigo.`, url: invite };
  const canShare = typeof navigator.share === 'function';
  try {
    if (canShare) await navigator.share(shareData);
    else await navigator.clipboard.writeText(invite);
    shareButton.textContent = canShare ? 'CONVITE ABERTO' : 'LINK COPIADO';
  } catch {
    await navigator.clipboard.writeText(invite).catch(() => undefined);
    shareButton.textContent = 'LINK COPIADO';
  }
  window.setTimeout(() => { shareButton.textContent = 'COPIAR CONVITE'; }, 1_800);
});

$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    // Fullscreen is optional on browsers that deny it.
  }
});

$('#leave-button').addEventListener('click', () => {
  network.leave();
  location.href = `${location.pathname}?room=${latestSnapshot?.roomCode || roomInput.value}`;
});

let audioContext: AudioContext | undefined;
function playImpactSound(hit: HitEvent): void {
  try {
    audioContext ??= new AudioContext();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = hit.special ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(hit.blocked ? 390 : hit.special ? 145 : 95, now);
    oscillator.frequency.exponentialRampToValueAtTime(hit.blocked ? 210 : 42, now + (hit.special ? 0.28 : 0.12));
    gain.gain.setValueAtTime(hit.blocked ? 0.045 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (hit.special ? 0.3 : 0.14));
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (hit.special ? 0.3 : 0.14));
    if (navigator.vibrate) navigator.vibrate(hit.special ? [24, 28, 45] : hit.blocked ? 12 : 24);
  } catch {
    // Audio and vibration remain progressive enhancements.
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
