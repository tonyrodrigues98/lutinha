import {
  AdditiveBlending,
  AmbientLight,
  AnimationAction,
  AnimationMixer,
  CanvasTexture,
  CircleGeometry,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LinearFilter,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  RepeatWrapping,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { NetworkClient } from './network';
import type { FighterAction, HitEvent, MatchSnapshot, PlayerSnapshot } from './types';
import { AssetVault, fighterColor, weaponClass } from './assets';

interface FighterView {
  root: Group;
  model: Object3D;
  mixer: AnimationMixer;
  current?: AnimationAction;
  action: FighterAction;
  target: Vector3;
  facing: -1 | 1;
  weaponClass: ReturnType<typeof weaponClass>;
  label: Sprite;
}

interface TimedEffect {
  object: Object3D;
  age: number;
  duration: number;
  update: (progress: number) => void;
}

const WORLD_SCALE = 210;
const worldX = (x: number) => (x - 1100) / WORLD_SCALE;
const worldY = (y: number) => (690 - y) / WORLD_SCALE;

const makeFloorTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#17181c';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(88,66,58,.46)';
  context.lineWidth = 5;
  for (let row = 0; row < 5; row += 1) {
    const y = row * 112 - 20;
    const offset = row % 2 ? -90 : 0;
    for (let column = 0; column < 7; column += 1) {
      const x = column * 180 + offset;
      context.beginPath();
      context.moveTo(x + 12, y + 16);
      context.lineTo(x + 152, y + 4);
      context.lineTo(x + 178, y + 86);
      context.lineTo(x + 34, y + 104);
      context.closePath();
      context.stroke();
    }
  }
  context.strokeStyle = 'rgba(251,92,52,.18)';
  context.lineWidth = 3;
  for (let index = 0; index < 18; index += 1) {
    const x = (index * 173) % 1024;
    const y = (index * 97) % 512;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 38, y + 16);
    context.lineTo(x + 61, y + 4);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2.2, 1.2);
  return texture;
};

const LOOPING_ACTIONS = new Set<FighterAction>(['idle', 'run', 'jump', 'block']);

const actionClip = (action: FighterAction, fighter: PlayerSnapshot): string => {
  const kind = weaponClass(fighter.weapon);
  if (action === 'intro') return 'Skeletons_Spawn_Ground';
  if (action === 'idle') return kind === 'magic' ? 'Ranged_Magic_Spellcasting' : kind === 'bow' ? 'Ranged_Bow_Idle' : kind === 'heavy' || kind === 'polearm' ? 'Melee_2H_Idle' : 'Skeletons_Idle';
  if (action === 'run') return kind === 'bow' ? 'Running_HoldingBow' : 'Running_A';
  if (action === 'dash') return 'Dodge_Forward';
  if (action === 'jump') return 'Jump_Full_Short';
  if (action === 'kick') return 'Melee_Unarmed_Attack_Kick';
  if (action === 'block') return 'Melee_Blocking';
  if (action === 'hurt') return 'Hit_A';
  if (action === 'ko') return 'Skeletons_Death';
  if (action === 'victory') return 'Cheering';
  if (action === 'special') {
    if (kind === 'magic') return 'Ranged_Magic_Summon';
    if (kind === 'bow' || kind === 'ranged') return 'Ranged_Bow_Release_Up';
    return kind === 'heavy' || kind === 'polearm' ? 'Melee_2H_Attack_Spin' : 'Melee_Dualwield_Attack_Slice';
  }
  if (kind === 'bow') return 'Ranged_Bow_Release';
  if (kind === 'ranged') return 'Ranged_1H_Shoot';
  if (kind === 'magic') return 'Ranged_Magic_Shoot';
  if (kind === 'dual') return 'Melee_Dualwield_Attack_Slice';
  if (kind === 'heavy') return 'Melee_2H_Attack_Chop';
  if (kind === 'polearm') return 'Melee_2H_Attack_Stab';
  return 'Melee_1H_Attack_Slice_Diagonal';
};

const makeLabel = (name: string, color: Color): Sprite => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d')!;
  context.font = '700 34px Poppins, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 10;
  context.strokeStyle = 'rgba(2,6,23,.92)';
  context.strokeText(name.toUpperCase(), 256, 48);
  context.fillStyle = `#${color.getHexString()}`;
  context.fillText(name.toUpperCase(), 256, 48);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.5, 0.32, 1);
  sprite.position.y = 2.85;
  sprite.renderOrder = 20;
  return sprite;
};

export class ThreeFightRenderer {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 80);
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock();
  private readonly fighters = new Map<string, FighterView>();
  private readonly effects: TimedEffect[] = [];
  private readonly background: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly network: NetworkClient;
  private readonly vault: AssetVault;
  private unsubscribe?: () => void;
  private frame = 0;
  private localTarget = new Vector3(0, 1.25, 0);
  private lastHitId = 0;
  private arena?: MatchSnapshot['arena'];
  private destroyed = false;

  constructor(container: HTMLElement, network: NetworkClient, vault: AssetVault) {
    this.network = network;
    this.vault = vault;
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = SRGBColorSpace;
    container.replaceChildren(this.renderer.domElement);

    this.scene.background = new Color(0x060912);
    this.camera.position.set(0, 2.55, 8.5);

    this.scene.add(new AmbientLight(0xaac9ff, 1.65));
    const keyLight = new DirectionalLight(0xffead1, 3.7);
    keyLight.position.set(-4, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -2;
    this.scene.add(keyLight);
    const rimLight = new DirectionalLight(0x5ac8ff, 2.6);
    rimLight.position.set(6, 4, -4);
    this.scene.add(rimLight);

    this.background = new Mesh(
      new PlaneGeometry(25, 12),
      new MeshBasicMaterial({ side: DoubleSide }),
    );
    this.background.position.set(0, 3.9, -3.2);
    this.scene.add(this.background);

    const floor = new Mesh(
      new PlaneGeometry(20, 5.2),
      new MeshStandardMaterial({
        map: makeFloorTexture(),
        color: 0x6f625f,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.025, 0.1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const floorGlow = new Mesh(
      new PlaneGeometry(11.5, 0.028),
      new MeshBasicMaterial({ color: 0xff7148, transparent: true, opacity: 0.48, blending: AdditiveBlending }),
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.set(0, 0.01, -0.25);
    this.scene.add(floorGlow);

    this.addArenaProps();
    this.unsubscribe = network.onSnapshot((snapshot) => this.consume(snapshot));
    window.addEventListener('resize', this.resize);
    this.resize();
    this.animate();
  }

  private addArenaProps(): void {
    const propIds = ['bow_A', 'bow_B', 'fistweapon_A_stacked', 'fistweapon_B_stacked', 'Skeleton_Arrow_Broken', 'Skeleton_Arrow_Broken_Half'];
    propIds.forEach((id, index) => {
      const prop = this.vault.cloneModel(id);
      prop.scale.setScalar(0.62);
      prop.position.set(-7.1 + index * 2.85, 0.02, -1.8);
      prop.rotation.set(index % 2 ? -0.2 : 0.1, index % 2 ? 0.6 : -0.6, Math.PI / 2);
      this.scene.add(prop);
    });
  }

  private consume(snapshot: MatchSnapshot): void {
    if (snapshot.arena !== this.arena) {
      this.arena = snapshot.arena;
      const texture = this.vault.textures.get(snapshot.arena);
      if (texture) {
        texture.colorSpace = SRGBColorSpace;
        this.background.material.map = texture;
        this.background.material.needsUpdate = true;
      }
    }

    const liveIds = new Set(snapshot.players.map((player) => player.id));
    for (const [id, view] of this.fighters) {
      if (!liveIds.has(id)) {
        this.scene.remove(view.root);
        this.fighters.delete(id);
      }
    }
    snapshot.players.forEach((player) => this.updateFighter(player));

    if (snapshot.hit && snapshot.hit.id !== this.lastHitId) {
      this.lastHitId = snapshot.hit.id;
      this.playHit(snapshot.hit);
    }
  }

  private updateFighter(player: PlayerSnapshot): void {
    let view = this.fighters.get(player.id);
    if (!view) {
      const root = new Group();
      const model = this.vault.cloneCharacter(player.skin);
      this.vault.tintGlow(model, player.color);
      root.add(model);
      const mixer = new AnimationMixer(model);
      const label = makeLabel(player.name, fighterColor(player.color));
      root.add(label);

      const shadow = new Mesh(
        new CircleGeometry(0.62, 32),
        new ShadowMaterial({ color: 0x000000, opacity: 0.36 }),
      );
      shadow.scale.y = 0.42;
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.012;
      root.add(shadow);

      this.attachEquipment(model, player);
      view = {
        root,
        model,
        mixer,
        action: 'idle',
        target: new Vector3(),
        facing: player.facing,
        weaponClass: weaponClass(player.weapon),
        label,
      };
      this.fighters.set(player.id, view);
      this.scene.add(root);
      this.playAnimation(view, 'intro', player);
    }

    view.target.set(worldX(player.x), worldY(player.y), player.team === 'blue' ? 0.08 : -0.08);
    view.facing = player.facing;
    const desiredRotation = player.facing === 1 ? Math.PI / 2 : -Math.PI / 2;
    view.model.rotation.y = desiredRotation;
    if (view.action !== player.action) {
      view.action = player.action;
      this.playAnimation(view, player.action, player);
      if (player.action === 'attack' || player.action === 'special') this.launchAttackVisual(view, player);
    }
    if (player.id === this.network.id) this.localTarget.copy(view.target);
  }

  private attachEquipment(model: Object3D, player: PlayerSnapshot): void {
    const right = model.getObjectByName('handslot.r') ?? model.getObjectByName('hand.r');
    const left = model.getObjectByName('handslot.l') ?? model.getObjectByName('hand.l');
    const equip = (slot: Object3D | undefined, id: string, mirror = false) => {
      if (!slot) return;
      const item = this.vault.cloneModel(id);
      item.name = `equipped:${id}`;
      if (mirror) item.rotation.y = Math.PI;
      slot.add(item);
    };

    equip(right, player.weapon);
    if (viewNeedsDualWeapon(player.weapon)) equip(left, player.weapon, true);
    else if (player.shield !== 'none') equip(left, player.shield);
    if (player.weapon === 'bow_A_withString' || player.weapon === 'bow_B_withString' || player.weapon === 'Skeleton_Crossbow') {
      const quiver = this.vault.cloneModel('Skeleton_Quiver');
      quiver.scale.setScalar(0.9);
      quiver.position.set(-0.28, 1.15, -0.3);
      quiver.rotation.set(0.2, 0, -0.35);
      model.add(quiver);
    }
  }

  private playAnimation(view: FighterView, action: FighterAction, player: PlayerSnapshot): void {
    const clip = this.vault.animations.get(actionClip(action, player))
      ?? this.vault.animations.get('Skeletons_Idle');
    if (!clip) return;
    const next = view.mixer.clipAction(clip, view.model);
    const looping = LOOPING_ACTIONS.has(action);
    next.reset();
    next.enabled = true;
    next.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
    next.clampWhenFinished = !looping;
    next.setEffectiveTimeScale(action === 'run' ? 1.2 : action === 'attack' || action === 'kick' ? 1.45 : action === 'hurt' ? 1.35 : 1);
    next.fadeIn(0.09).play();
    view.current?.fadeOut(0.1);
    view.current = next;
  }

  private launchAttackVisual(view: FighterView, fighter: PlayerSnapshot): void {
    if (!['bow', 'ranged', 'magic'].includes(view.weaponClass)) return;
    let projectile: Object3D;
    if (view.weaponClass === 'magic') {
      projectile = new Mesh(
        new SphereGeometry(0.16, 16, 12),
        new MeshBasicMaterial({ color: fighterColor(fighter.color), transparent: true, opacity: 0.95, blending: AdditiveBlending }),
      );
    } else {
      projectile = this.vault.cloneModel(fighter.weapon === 'Skeleton_Crossbow' ? 'Skeleton_Arrow' : fighter.team === 'blue' ? 'arrow_A' : 'arrow_B');
      projectile.scale.setScalar(0.78);
      projectile.rotation.z = fighter.facing === 1 ? -Math.PI / 2 : Math.PI / 2;
    }
    const start = view.root.position.clone().add(new Vector3(fighter.facing * 0.45, 1.25, 0));
    projectile.position.copy(start);
    this.scene.add(projectile);
    const travel = fighter.action === 'special' ? 11 : 7.5;
    this.effects.push({
      object: projectile,
      age: 0,
      duration: fighter.action === 'special' ? 0.48 : 0.34,
      update: (progress) => {
        projectile.position.x = start.x + fighter.facing * travel * progress;
        projectile.position.y = start.y + Math.sin(progress * Math.PI) * 0.18;
        projectile.scale.multiplyScalar(1.001);
      },
    });
  }

  private playHit(hit: HitEvent): void {
    const color = new Color(hit.blocked ? 0xfbbf24 : hit.special ? 0xf8fafc : hit.kind === 'kick' ? 0xfde68a : 0xff796c);
    const orb = new Mesh(
      new SphereGeometry(hit.special ? 0.38 : 0.22, 20, 14),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }),
    );
    orb.position.set(worldX(hit.x), Math.max(0.7, worldY(hit.y) + 0.8), 0.45);
    this.scene.add(orb);
    this.effects.push({
      object: orb,
      age: 0,
      duration: hit.special ? 0.42 : 0.25,
      update: (progress) => {
        orb.scale.setScalar(1 + progress * (hit.special ? 4.2 : 2.4));
        (orb.material as MeshBasicMaterial).opacity = 1 - progress;
      },
    });
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    for (const view of this.fighters.values()) {
      view.root.position.lerp(view.target, 1 - Math.pow(0.001, dt));
      view.mixer.update(dt);
      view.label.quaternion.copy(this.camera.quaternion);
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      effect.update(progress);
      if (progress >= 1) {
        this.scene.remove(effect.object);
        this.effects.splice(index, 1);
      }
    }

    const desiredCamera = new Vector3(this.localTarget.x, 2.45, 8.1);
    this.camera.position.lerp(desiredCamera, 1 - Math.pow(0.035, dt));
    this.camera.lookAt(this.localTarget.x, 1.15, 0);
    this.renderer.render(this.scene, this.camera);
  };

  private resize = (): void => {
    const parent = this.renderer.domElement.parentElement;
    const width = parent?.clientWidth || innerWidth;
    const height = parent?.clientHeight || innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = width < 1_000 && width > height ? 48 : 42;
    this.camera.updateProjectionMatrix();
  };

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.unsubscribe?.();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const viewNeedsDualWeapon = (weapon: PlayerSnapshot['weapon']): boolean => (
  weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')
);
