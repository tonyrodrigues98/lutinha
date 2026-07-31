import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import { FIGHTERS, AssetVault, SHIELD_LABELS, WEAPON_LABELS, weaponClass } from './game/assets';
import { NetworkClient } from './game/network';
import { ThreeFightRenderer } from './game/ThreeFightRenderer';
import {
  SHIELD_IDS,
  WEAPON_IDS,
  type ArenaTheme,
  type FighterColor,
  type FighterSkin,
  type HitEvent,
  type MatchSnapshot,
  type PlayerInput,
  type PlayerSnapshot,
  type ShieldId,
  type Team,
  type WeaponId,
} from './game/types';

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
  return element;
};

const network = new NetworkClient();
const vault = new AssetVault();
let selectedTeam: Team = 'blue';
let selectedFighter: FighterSkin = 'mage';
let selectedColor: FighterColor = 'azure';
let selectedArena: ArenaTheme = 'riftfall';
let selectedWeapon: WeaponId = FIGHTERS.mage.defaultWeapon;
let selectedShield: ShieldId = FIGHTERS.mage.defaultShield;
let game: ThreeFightRenderer | undefined;
let latestSnapshot: MatchSnapshot | undefined;
let inputSequence = 0;
let lastAudioHit = 0;
let comboCount = 0;
let comboAttackerId = '';
let lastComboAt = 0;
let comboTimer = 0;

const bootScreen = $('#boot-screen');
const bootProgress = $('#boot-progress');
const bootPercent = $('#boot-percent');
const bootLabel = $('#boot-label');
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
const attackButtonLabel = $('.attack-button span');
const comboIndicator = $('#combo-indicator');
const comboCountLabel = $('#combo-count');
const motionButton = $('#motion-button') as HTMLButtonElement;

const isEditableTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLInputElement
  || target instanceof HTMLTextAreaElement
  || (target instanceof HTMLElement && target.isContentEditable)
);

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
    if (now - lastTouchEnd <= 350 && !isEditableTarget(event.target)) event.preventDefault();
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

const savedReducedMotion = localStorage.getItem('riftfall-reduced-motion') === 'true';
document.body.classList.toggle('reduce-motion', savedReducedMotion);
motionButton.setAttribute('aria-pressed', String(savedReducedMotion));
motionButton.classList.toggle('active', savedReducedMotion);

async function enterImmersiveMode(): Promise<void> {
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // iPhone Safari exposes absolute fullscreen only for installed PWAs.
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    // Orientation lock is a progressive enhancement.
  }
}

const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomControlCharacters = /[\u0000-\u001f\u007f-\u009f]/g;
const sanitizeRoomName = (value: string, trim = false): string => {
  const safeValue = value.normalize('NFC').replace(roomControlCharacters, '');
  const limitedValue = Array.from(safeValue).slice(0, 24).join('');
  return trim ? limitedValue.trim() : limitedValue;
};

function generateRoomName(): string {
  const values = new Uint32Array(5);
  crypto.getRandomValues(values);
  const suffix = [...values].map((value) => roomAlphabet[value % roomAlphabet.length]).join('');
  return `Cripta ${suffix}`;
}

function roomInviteUrl(roomName: string): string {
  const invite = new URL(location.pathname, location.origin);
  invite.searchParams.set('room', roomName);
  return invite.toString();
}

const selectButtons = <T extends string>(selector: string, value: T, dataKey: string): void => {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((choice) => {
    const selected = choice.dataset[dataKey] === value;
    choice.classList.toggle('selected', selected);
    choice.setAttribute('aria-pressed', String(selected));
  });
};

const updateAttackLabel = (): void => {
  const kind = weaponClass(selectedWeapon);
  attackButtonLabel.textContent = kind === 'magic' ? 'CONJURAR' : kind === 'bow' || kind === 'ranged' ? 'DISPARAR' : 'ATACAR';
};

function chooseWeapon(weapon: WeaponId): void {
  selectedWeapon = weapon;
  localStorage.setItem('riftfall-weapon', weapon);
  selectButtons('.weapon-choice', weapon, 'weapon');
  if (['bow', 'ranged', 'magic', 'dual', 'heavy', 'polearm'].includes(weaponClass(weapon))) {
    chooseShield('none');
  }
  updateAttackLabel();
}

function chooseShield(shield: ShieldId): void {
  selectedShield = shield;
  localStorage.setItem('riftfall-shield', shield);
  selectButtons('.shield-choice', shield, 'shield');
}

const weaponGrid = $('#weapon-grid');
WEAPON_IDS.forEach((weapon) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'weapon-choice';
  button.dataset.weapon = weapon;
  button.setAttribute('aria-pressed', 'false');
  button.textContent = WEAPON_LABELS[weapon];
  button.addEventListener('click', () => chooseWeapon(weapon));
  weaponGrid.append(button);
});

const shieldGrid = $('#shield-grid');
SHIELD_IDS.forEach((shield) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'shield-choice';
  button.dataset.shield = shield;
  button.setAttribute('aria-pressed', 'false');
  button.textContent = SHIELD_LABELS[shield];
  button.addEventListener('click', () => chooseShield(shield));
  shieldGrid.append(button);
});

const queryRoom = new URLSearchParams(location.search).get('room');
roomInput.value = sanitizeRoomName(queryRoom || '', true) || generateRoomName();
nameInput.value = localStorage.getItem('riftfall-player-name') || '';

document.querySelectorAll<HTMLButtonElement>('.team-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedTeam = button.dataset.team as Team;
    selectButtons('.team-choice', selectedTeam, 'team');
  });
});

document.querySelectorAll<HTMLButtonElement>('.fighter-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedFighter = button.dataset.fighter as FighterSkin;
    localStorage.setItem('riftfall-fighter', selectedFighter);
    selectButtons('.fighter-choice', selectedFighter, 'fighter');
    chooseWeapon(FIGHTERS[selectedFighter].defaultWeapon);
    chooseShield(FIGHTERS[selectedFighter].defaultShield);
  });
});

document.querySelectorAll<HTMLButtonElement>('.color-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedColor = button.dataset.color as FighterColor;
    localStorage.setItem('riftfall-color', selectedColor);
    selectButtons('.color-choice', selectedColor, 'color');
  });
});

document.querySelectorAll<HTMLButtonElement>('.arena-choice').forEach((button) => {
  button.addEventListener('click', () => {
    selectedArena = button.dataset.arena as ArenaTheme;
    localStorage.setItem('riftfall-arena', selectedArena);
    lobby.dataset.arena = selectedArena;
    selectButtons('.arena-choice', selectedArena, 'arena');
  });
});

const savedFighter = localStorage.getItem('riftfall-fighter') as FighterSkin | null;
const savedColor = localStorage.getItem('riftfall-color') as FighterColor | null;
const savedArena = localStorage.getItem('riftfall-arena') as ArenaTheme | null;
const savedWeapon = localStorage.getItem('riftfall-weapon') as WeaponId | null;
const savedShield = localStorage.getItem('riftfall-shield') as ShieldId | null;
document.querySelector<HTMLButtonElement>(`.fighter-choice[data-fighter="${savedFighter && savedFighter in FIGHTERS ? savedFighter : 'mage'}"]`)?.click();
if (savedColor) document.querySelector<HTMLButtonElement>(`.color-choice[data-color="${savedColor}"]`)?.click();
if (savedArena) document.querySelector<HTMLButtonElement>(`.arena-choice[data-arena="${savedArena}"]`)?.click();
if (savedWeapon && WEAPON_IDS.includes(savedWeapon)) chooseWeapon(savedWeapon);
if (savedShield && SHIELD_IDS.includes(savedShield)) chooseShield(savedShield);

$('#new-room').addEventListener('click', () => {
  roomInput.value = generateRoomName();
  lobbyError.textContent = '';
});

roomInput.addEventListener('input', () => {
  roomInput.value = sanitizeRoomName(roomInput.value);
});

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  void enterImmersiveMode();
  lobbyError.textContent = '';
  joinButton.disabled = true;
  joinButton.querySelector('span')!.textContent = 'CONECTANDO...';

  const name = nameInput.value.trim();
  const roomCode = sanitizeRoomName(roomInput.value, true);
  roomInput.value = roomCode;
  const result = await network.join({
    name,
    roomCode,
    team: selectedTeam,
    skin: selectedFighter,
    color: selectedColor,
    weapon: selectedWeapon,
    shield: selectedShield,
    arena: selectedArena,
  });
  if (!result.ok) {
    lobbyError.textContent = result.message || 'Não foi possível entrar na arena.';
    joinButton.disabled = false;
    joinButton.querySelector('span')!.textContent = 'ENTRAR NA ARENA';
    return;
  }

  localStorage.setItem('riftfall-player-name', name);
  history.replaceState(null, '', roomInviteUrl(result.roomCode || roomCode));
  document.body.classList.add('game-active');
  lobby.classList.add('hidden');
  gameShell.classList.remove('hidden');
  game ??= new ThreeFightRenderer($('#game-canvas'), network, vault);
});

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
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic accessibility events may not expose an active pointer.
    }
    setInput(action, true);
    button.classList.add('pressed');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
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
    const now = Date.now();
    comboCount = snapshot.hit.attackerId === comboAttackerId && now - lastComboAt < 1_250 ? comboCount + 1 : 1;
    comboAttackerId = snapshot.hit.attackerId;
    lastComboAt = now;
    window.clearTimeout(comboTimer);
    comboIndicator.classList.toggle('local', snapshot.hit.attackerId === network.id);
    if (comboCount >= 2) {
      comboCountLabel.textContent = String(comboCount);
      comboIndicator.classList.remove('visible');
      void comboIndicator.offsetWidth;
      comboIndicator.classList.add('visible');
    }
    comboTimer = window.setTimeout(() => {
      comboIndicator.classList.remove('visible');
      comboCount = 0;
      comboAttackerId = '';
    }, 1_050);
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
  $(`#${team}-energy`).textContent = `ESSÊNCIA ${player?.energy ?? 0}%`;
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
    bannerKicker.textContent = `SALA ${snapshot.roomCode}`;
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
  } else {
    const winner = snapshot.players.find((player) => player.id === snapshot.winnerId);
    banner.classList.add('visible');
    bannerKicker.textContent = 'CAMPEÃO DA CRIPTA';
    bannerTitle.textContent = winner?.name.toUpperCase() || 'FIM DA LUTA';
    shareButton.classList.add('hidden');
  }
}

shareButton.addEventListener('click', async () => {
  const roomCode = latestSnapshot?.roomCode || roomInput.value;
  const invite = roomInviteUrl(roomCode);
  const shareData = { title: 'Riftfall Arsenal', text: `Entre na sala “${roomCode}” e lute comigo.`, url: invite };
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

motionButton.addEventListener('click', () => {
  const reduced = !document.body.classList.contains('reduce-motion');
  document.body.classList.toggle('reduce-motion', reduced);
  motionButton.classList.toggle('active', reduced);
  motionButton.setAttribute('aria-pressed', String(reduced));
  localStorage.setItem('riftfall-reduced-motion', String(reduced));
});

$('#leave-button').addEventListener('click', () => {
  network.leave();
  location.href = roomInviteUrl(latestSnapshot?.roomCode || roomInput.value);
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
    oscillator.frequency.exponentialRampToValueAtTime(hit.blocked ? 210 : 42, now + (hit.special ? 0.28 : 0.14));
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

async function boot(): Promise<void> {
  try {
    await vault.preload((progress, label) => {
      const percent = Math.round(progress * 100);
      bootProgress.style.width = `${percent}%`;
      bootPercent.textContent = `${percent}%`;
      bootLabel.textContent = label;
    });
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    bootScreen.classList.add('hidden');
    lobby.classList.remove('hidden');
  } catch (error) {
    bootLabel.textContent = 'Não foi possível carregar o arsenal.';
    bootPercent.textContent = 'TENTAR NOVAMENTE';
    bootPercent.setAttribute('role', 'button');
    bootPercent.addEventListener('click', () => location.reload(), { once: true });
    console.error(error);
  }
}

void boot();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
