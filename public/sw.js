const CACHE = 'riftfall-arsenal-v8-online-loadout-projectiles';
const ROOT = new URL('./', self.location.href);
const asset = (path) => new URL(path.replace(/^\//, ''), ROOT).href;

const CORE = [
  '',
  'manifest.webmanifest',
  'icon.svg',
  'assets/riftfall-arena.webp',
  'assets/arena-ember-forge.webp',
  'assets/arena-neon-ruins.webp',
  'assets/arena-astral-sanctuary.webp',
  ...[
    'mage.webp', 'minion.webp', 'rogue.webp', 'warrior.webp',
    'barbarian.png', 'knight.png', 'mage.png', 'ranger.png',
    'rogue.png', 'rogue_hooded.png', 'mannequinMedium.png', 'mannequinLarge.png',
  ].map((name) => `assets/kaykit/portraits/${name}`),
];

const GAME_ASSETS = [
  ...[
    'Skeleton_Mage', 'Skeleton_Minion', 'Skeleton_Rogue', 'Skeleton_Warrior',
    'Barbarian', 'Knight', 'Mage', 'Ranger', 'Rogue', 'Rogue_Hooded',
    'Mannequin_Medium', 'Mannequin_Large',
  ].map((name) => `assets/kaykit/characters/${name}.glb`),
  ...[
    'Rig_Medium_CombatMelee', 'Rig_Medium_CombatRanged', 'Rig_Medium_General',
    'Rig_Medium_MovementAdvanced', 'Rig_Medium_MovementBasic',
    'Rig_Medium_Simulation', 'Rig_Medium_Special', 'Rig_Medium_Tools',
    'Rig_Large_CombatMelee', 'Rig_Large_General', 'Rig_Large_MovementAdvanced',
    'Rig_Large_MovementBasic', 'Rig_Large_Simulation', 'Rig_Large_Special',
  ].map((name) => `assets/kaykit/animations/${name}.glb`),
  ...[
    'Skeleton_Axe', 'Skeleton_Blade', 'Skeleton_Crossbow', 'Skeleton_Staff',
    'axe_A', 'axe_B', 'axe_C', 'bow_A_withString', 'bow_B_withString',
    'dagger_A', 'dagger_B', 'fistweapon_A', 'fistweapon_B', 'halberd',
    'hammer_A', 'hammer_B', 'hammer_C', 'spear_A', 'staff_A', 'staff_B',
    'sword_A', 'sword_B', 'sword_C', 'sword_D', 'sword_E', 'wand_A',
    'axe_1handed', 'axe_2handed', 'bow', 'bow_withString',
    'crossbow_1handed', 'crossbow_2handed', 'dagger', 'smokebomb',
    'spellbook_closed', 'spellbook_open', 'staff', 'sword_1handed',
    'sword_2handed', 'sword_2handed_color', 'wand',
    'Skeleton_Shield_Large_A', 'Skeleton_Shield_Large_B',
    'Skeleton_Shield_Small_A', 'Skeleton_Shield_Small_B',
    'shield_A', 'shield_B', 'shield_C', 'shield_badge', 'shield_badge_color',
    'shield_round', 'shield_round_barbarian', 'shield_round_color',
    'shield_spikes', 'shield_spikes_color', 'shield_square', 'shield_square_color',
  ].map((name) => `assets/kaykit/weapons/${name}.glb`),
];

async function cacheCompleteGame() {
  const cache = await caches.open(CACHE);
  for (const path of [...CORE, ...GAME_ASSETS]) {
    const url = asset(path);
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    } catch {
      // One optional offline asset must not abort installation of the new worker.
    }
  }

  const shell = await fetch(asset(''), { cache: 'reload' });
  if (!shell.ok) return;
  await cache.put(asset(''), shell.clone());
  const html = await shell.text();
  const buildAssets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
    .map((match) => new URL(match[1], ROOT).href);
  await Promise.all(buildAssets.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await cache.put(url, response);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheCompleteGame());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/socket.io/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request))
        || (await caches.match(asset('')))
        || Response.error();
    }
  })());
});
