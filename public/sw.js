const CACHE = 'riftfall-arsenal-v2-cpu';
const CORE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/assets/riftfall-arena.webp',
  '/assets/arena-ember-forge.webp',
  '/assets/arena-neon-ruins.webp',
  '/assets/arena-astral-sanctuary.webp',
  '/assets/kaykit/portraits/mage.webp',
  '/assets/kaykit/portraits/minion.webp',
  '/assets/kaykit/portraits/rogue.webp',
  '/assets/kaykit/portraits/warrior.webp',
];

const GAME_ASSETS = [
  ...['Mage', 'Minion', 'Rogue', 'Warrior'].map((name) => `/assets/kaykit/characters/Skeleton_${name}.glb`),
  ...[
    'CombatMelee', 'CombatRanged', 'General', 'MovementAdvanced',
    'MovementBasic', 'Simulation', 'Special', 'Tools',
  ].map((name) => `/assets/kaykit/animations/Rig_Medium_${name}.glb`),
  ...[
    'Skeleton_Axe', 'Skeleton_Blade', 'Skeleton_Crossbow', 'Skeleton_Staff',
    'axe_A', 'axe_B', 'axe_C', 'bow_A_withString', 'bow_B_withString',
    'dagger_A', 'dagger_B', 'fistweapon_A', 'fistweapon_B', 'halberd',
    'hammer_A', 'hammer_B', 'hammer_C', 'spear_A', 'staff_A', 'staff_B',
    'sword_A', 'sword_B', 'sword_C', 'sword_D', 'sword_E', 'wand_A',
    'Skeleton_Shield_Large_A', 'Skeleton_Shield_Large_B',
    'Skeleton_Shield_Small_A', 'Skeleton_Shield_Small_B',
    'shield_A', 'shield_B', 'shield_C', 'Skeleton_Arrow', 'Skeleton_Arrow_Broken',
    'Skeleton_Arrow_Broken_Half', 'Skeleton_Arrow_Half', 'Skeleton_Quiver',
    'arrow_A', 'arrow_B', 'bow_A', 'bow_B', 'fistweapon_A_stacked',
    'fistweapon_B_stacked',
  ].map((name) => `/assets/kaykit/weapons/${name}.glb`),
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll([...CORE, ...GAME_ASSETS]);
    const shell = await fetch('/');
    const html = await shell.clone().text();
    await cache.put('/', shell);
    const buildAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    if (buildAssets.length) await cache.addAll(buildAssets);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/socket.io/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (!response.ok) return response;
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))));
});
