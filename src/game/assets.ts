import {
  AnimationClip,
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  TextureLoader,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { ArenaTheme, FighterColor, FighterSkin, ShieldId, WeaponId } from './types';
import { SHIELD_IDS, WEAPON_IDS } from './types';

export const FIGHTERS: Record<FighterSkin, {
  name: string;
  role: string;
  model: string;
  defaultWeapon: WeaponId;
  defaultShield: ShieldId;
  scale: number;
}> = {
  mage: {
    name: 'Necromante',
    role: 'Magia · alcance',
    model: 'Skeleton_Mage',
    defaultWeapon: 'Skeleton_Staff',
    defaultShield: 'none',
    scale: 0.98,
  },
  minion: {
    name: 'Rastejante',
    role: 'Ágil · imprevisível',
    model: 'Skeleton_Minion',
    defaultWeapon: 'dagger_A',
    defaultShield: 'shield_A',
    scale: 0.93,
  },
  rogue: {
    name: 'Lâmina Sombria',
    role: 'Duas armas · veloz',
    model: 'Skeleton_Rogue',
    defaultWeapon: 'dagger_B',
    defaultShield: 'none',
    scale: 1,
  },
  warrior: {
    name: 'Guardião Ósseo',
    role: 'Pesado · resistente',
    model: 'Skeleton_Warrior',
    defaultWeapon: 'Skeleton_Axe',
    defaultShield: 'Skeleton_Shield_Large_A',
    scale: 1.04,
  },
};

export const WEAPON_LABELS: Record<WeaponId, string> = {
  Skeleton_Axe: 'Machado rúnico',
  Skeleton_Blade: 'Lâmina óssea',
  Skeleton_Crossbow: 'Besta sombria',
  Skeleton_Staff: 'Cajado necromante',
  axe_A: 'Machado A',
  axe_B: 'Machado B',
  axe_C: 'Machado C',
  bow_A_withString: 'Arco do caçador',
  bow_B_withString: 'Arco real',
  dagger_A: 'Adaga A',
  dagger_B: 'Adaga B',
  fistweapon_A: 'Manopla A',
  fistweapon_B: 'Manopla B',
  halberd: 'Alabarda',
  hammer_A: 'Martelo A',
  hammer_B: 'Martelo B',
  hammer_C: 'Martelo C',
  spear_A: 'Lança',
  staff_A: 'Cajado A',
  staff_B: 'Cajado B',
  sword_A: 'Espada A',
  sword_B: 'Espada B',
  sword_C: 'Espada C',
  sword_D: 'Espada D',
  sword_E: 'Espada E',
  wand_A: 'Varinha',
};

export const SHIELD_LABELS: Record<ShieldId, string> = {
  none: 'Sem escudo',
  Skeleton_Shield_Large_A: 'Escudo grande A',
  Skeleton_Shield_Large_B: 'Escudo grande B',
  Skeleton_Shield_Small_A: 'Escudo pequeno A',
  Skeleton_Shield_Small_B: 'Escudo pequeno B',
  shield_A: 'Escudo A',
  shield_B: 'Escudo B',
  shield_C: 'Escudo C',
};

export const ARENA_TEXTURES: Record<ArenaTheme, string> = {
  riftfall: '/assets/riftfall-arena.webp',
  ember: '/assets/arena-ember-forge.webp',
  neon: '/assets/arena-neon-ruins.webp',
  astral: '/assets/arena-astral-sanctuary.webp',
};

const EXTRA_PROP_IDS = [
  'Skeleton_Arrow',
  'Skeleton_Arrow_Broken',
  'Skeleton_Arrow_Broken_Half',
  'Skeleton_Arrow_Half',
  'Skeleton_Quiver',
  'arrow_A',
  'arrow_B',
  'bow_A',
  'bow_B',
  'fistweapon_A_stacked',
  'fistweapon_B_stacked',
] as const;

const ANIMATION_PACKS = [
  'Rig_Medium_CombatMelee',
  'Rig_Medium_CombatRanged',
  'Rig_Medium_General',
  'Rig_Medium_MovementAdvanced',
  'Rig_Medium_MovementBasic',
  'Rig_Medium_Simulation',
  'Rig_Medium_Special',
  'Rig_Medium_Tools',
] as const;

const colorValues: Record<FighterColor, number> = {
  azure: 0x38bdf8,
  crimson: 0xfb4f58,
  emerald: 0x34d399,
  violet: 0xa78bfa,
  gold: 0xfbbf24,
  fuchsia: 0xf472b6,
  cyan: 0x22d3ee,
  lime: 0xa3e635,
  orange: 0xfb923c,
  ice: 0xdbeafe,
  coral: 0xff7f73,
  silver: 0xcbd5e1,
};

export const fighterColor = (color: FighterColor): Color => new Color(colorValues[color]);

type ProgressCallback = (progress: number, label: string) => void;

export class AssetVault {
  readonly characters = new Map<FighterSkin, GLTF>();
  readonly models = new Map<string, GLTF>();
  readonly animations = new Map<string, AnimationClip>();
  readonly textures = new Map<ArenaTheme, Texture>();
  private readonly loader = new GLTFLoader();
  private loaded = false;

  async preload(onProgress: ProgressCallback): Promise<void> {
    if (this.loaded) {
      onProgress(1, 'Arsenal pronto');
      return;
    }

    const jobs: Array<{ label: string; run: () => Promise<void> }> = [];
    (Object.keys(FIGHTERS) as FighterSkin[]).forEach((skin) => {
      jobs.push({
        label: FIGHTERS[skin].name,
        run: async () => {
          const gltf = await this.loader.loadAsync(`/assets/kaykit/characters/${FIGHTERS[skin].model}.glb`);
          this.characters.set(skin, gltf);
        },
      });
    });
    ANIMATION_PACKS.forEach((pack) => {
      jobs.push({
        label: `Animações · ${pack.replace('Rig_Medium_', '')}`,
        run: async () => {
          const gltf = await this.loader.loadAsync(`/assets/kaykit/animations/${pack}.glb`);
          gltf.animations.forEach((clip) => {
            if (clip.name !== 'T-Pose') this.animations.set(clip.name, clip);
          });
        },
      });
    });
    [...WEAPON_IDS, ...SHIELD_IDS.filter((id) => id !== 'none'), ...EXTRA_PROP_IDS].forEach((id) => {
      jobs.push({
        label: `Arsenal · ${id}`,
        run: async () => {
          this.models.set(id, await this.loader.loadAsync(`/assets/kaykit/weapons/${id}.glb`));
        },
      });
    });
    (Object.keys(FIGHTERS) as FighterSkin[]).forEach((skin) => {
      jobs.push({
        label: `Retrato · ${FIGHTERS[skin].name}`,
        run: async () => {
          const response = await fetch(`/assets/kaykit/portraits/${skin}.webp`);
          if (!response.ok) throw new Error(`Retrato ausente: ${skin}`);
          const bitmap = await createImageBitmap(await response.blob());
          bitmap.close();
        },
      });
    });
    (Object.entries(ARENA_TEXTURES) as Array<[ArenaTheme, string]>).forEach(([arena, url]) => {
      jobs.push({
        label: `Arena · ${arena}`,
        run: async () => {
          this.textures.set(arena, await new TextureLoader().loadAsync(url));
        },
      });
    });

    const total = jobs.length;
    let completed = 0;
    const workers = Array.from({ length: 5 }, async () => {
      while (jobs.length) {
        const job = jobs.shift();
        if (!job) break;
        onProgress(completed / total, job.label);
        await job.run();
        completed += 1;
        onProgress(completed / total, job.label);
      }
    });
    await Promise.all(workers);
    this.loaded = true;
    onProgress(1, `${this.animations.size} animações carregadas`);
  }

  cloneCharacter(skin: FighterSkin): Object3D {
    const source = this.characters.get(skin);
    if (!source) throw new Error(`Personagem não carregado: ${skin}`);
    const root = cloneSkeleton(source.scene);
    root.scale.setScalar(FIGHTERS[skin].scale);
    root.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return root;
  }

  cloneModel(id: string): Object3D {
    const source = this.models.get(id);
    if (!source) throw new Error(`Asset não carregado: ${id}`);
    const root = source.scene.clone(true);
    root.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return root;
  }

  tintGlow(root: Object3D, color: FighterColor): void {
    const accent = fighterColor(color);
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const cloneMaterial = (source: Material): Material => {
        const material = source.clone();
        if (material.name.toLowerCase().includes('glow') && material instanceof MeshStandardMaterial) {
          material.color.copy(accent);
          material.emissive.copy(accent);
          material.emissiveIntensity = 2.4;
        }
        return material;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(cloneMaterial)
        : cloneMaterial(node.material);
    });
  }
}

export const weaponClass = (weapon: WeaponId): 'bow' | 'magic' | 'ranged' | 'dual' | 'heavy' | 'polearm' | 'onehand' => {
  if (weapon.startsWith('bow_')) return 'bow';
  if (weapon === 'Skeleton_Crossbow') return 'ranged';
  if (weapon.includes('Staff') || weapon.startsWith('staff_') || weapon === 'wand_A') return 'magic';
  if (weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')) return 'dual';
  if (weapon.startsWith('hammer_') || weapon === 'halberd') return 'heavy';
  if (weapon === 'spear_A') return 'polearm';
  return 'onehand';
};
