import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import Phaser from 'phaser';
import { FightScene } from './game/FightScene';
import { NetworkClient } from './game/network';
import type { ArenaTheme, FighterColor, FighterSkin, HitEvent, MatchSnapshot, PlayerInput, PlayerSnapshot, Team } from './game/types';

const network = new NetworkClient();
let selectedTeam: Team = 'blue';
let selectedFighter: FighterSkin = 'vanguard';
let selectedColor: FighterColor = 'azure';
let selectedArena: ArenaTheme = 'riftfall';
let game: Phaser.Game | undefined;
let latestSnapshot: MatchSnapshot | undefined;
let inputSequence = 0;
let lastAudioHit = 0;

const isEditableTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLInputElement
  || target instanceof HTMLTextAreaElement
  || (target instanceof HTMLElement && target.isContentEditable)
);

// Safari on iPhone may still zoom despite the viewport directive.
// Block pinch, double-tap, selection and native gestures outside form fields.
const lockGameInterface = (): void => {
  const cancel = (event: Event) => event.preventDefault();
  document.addEventListener('gesturestart', cancel, { passive: false });
  document.addEventListener('gesturechange', cancel, { passive: false });
  document.addEventListener('gestureend', cancel, { passive: false });
  document.addEventListener('dblclick', cancel, { passive: false });
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('selectstart', (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });
  document.addEventListener('dragstart', cancel);
  document.addEventListener('contextmenu', (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
};

lockGameInterface();

const input: PlayerInput = {
  left: false,
  right: false,
  jump: false,
  attack: false,
  kick: false,
  dash: false,
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

async function enterImmersiveMode(): Promise<void> {
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // iPhone Safari only exposes true fullscreen when installed as a PWA.
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };
    await orientation.lock?.('landscape');
  } catch {
    // Orientation locking is optional and browser-dependent.
  }
}

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

document.querySelectorAll<HTMLButtonElement>('.fighter-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedFighter = button.dataset.fighter as FighterSkin;
    localStorage.setItem('riftfall-fighter', selectedFighter);
    document.querySelectorAll<HTMLButtonElement>('.fighter-choice').forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });
});

const savedFighter = localStorage.getItem('riftfall-fighter') as FighterSkin | null;
if (savedFighter && ['vanguard', 'ronin', 'titan', 'wraith'].includes(savedFighter)) {
  document.querySelector<HTMLButtonElement>(`.fighter-choice[data-fighter="${savedFighter}"]`)?.click();
}

document.querySelectorAll<HTMLButtonElement>('.color-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedColor = button.dataset.color as FighterColor;
    localStorage.setItem('riftfall-color', selectedColor);
    document.querySelectorAll<HTMLButtonElement>('.color-choice').forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });
});

const savedColor = localStorage.getItem('riftfall-color') as FighterColor | null;
if (savedColor && ['azure', 'crimson', 'emerald', 'violet', 'gold', 'fuchsia', 'cyan', 'lime', 'orange', 'ice', 'coral', 'silver'].includes(savedColor)) {
  document.querySelector<HTMLButtonElement>(`.color-choice[data-color="${savedColor}"]`)?.click();
}

document.querySelectorAll<HTMLButtonElement>('.arena-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedArena = button.dataset.arena as ArenaTheme;
    localStorage.setItem('riftfall-arena', selectedArena);
    lobby.dataset.arena = selectedArena;
    lobby.classList.remove('arena-changing');
    void lobby.offsetWidth;
    lobby.classList.add('arena-changing');
    document.querySelectorAll<HTMLButtonElement>('.arena-choice').forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });
});

const savedArena = localStorage.getItem('riftfall-arena') as ArenaTheme | null;
if (savedArena && ['riftfall', 'ember', 'neon', 'astral'].includes(savedArena)) {
  document.querySelector<HTMLButtonElement>(`.arena-choice[data-arena="${savedArena}"]`)?.click();
}

$('#new-room').addEventListener('click', () => {
  roomInput.value = generateRoomCode();
  lobbyError.textContent = '';
});

roomInput.addEventListener('input', () => {
  roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  void enterImmersiveMode();
  lobbyError.textContent = '';
  joinButton.disabled = true;
  joinButton.querySelector('span')!.textContent = 'CONECTANDO...';

  const name = nameInput.value.trim();
  const roomCode = roomInput.value.trim().toUpperCase();
  const result = await network.join({
    name,
    roomCode,
    team: selectedTeam,
    skin: selectedFighter,
    color: selectedColor,
    arena: selectedArena,
  });
  if (!result.ok) {
    lobbyError.textContent = result.message || 'Não foi possível entrar na arena.';
    joinButton.disabled = false;
    joinButton.querySelector('span')!.textContent = 'ENTRAR NA ARENA';
    return;
  }

  localStorage.setItem('riftfall-player-name', name);
  history.replaceState(null, '', `${location.pathname}?room=${result.roomCode}`);
  document.body.classList.add('game-active');
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
    input: { activePointers: 10 },
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
  KeyJ: 'attack', KeyI: 'kick', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyK: 'block', KeyL: 'special',
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
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  else await enterImmersiveMode();
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
    oscillator.type = hit.special ? 'sawtooth' : hit.kind === 'kick' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(hit.blocked ? 390 : hit.special ? 145 : hit.kind === 'kick' ? 72 : 95, now);
    oscillator.frequency.exponentialRampToValueAtTime(hit.blocked ? 210 : 42, now + (hit.special ? 0.28 : hit.kind === 'kick' ? 0.18 : 0.12));
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
