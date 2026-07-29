import Phaser from 'phaser';
import { ACTION_FRAMES, ACTION_SPEED, ensureFighterTextures, fighterTextureKey } from './sprites';
import type { NetworkClient } from './network';
import type { ArenaTheme, FighterAction, FighterColor, FighterSkin, HitEvent, MatchSnapshot, PlayerSnapshot, Team } from './types';

interface FighterView {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  team: Team;
  skin: FighterSkin;
  color: FighterColor;
  action: FighterAction;
  targetX: number;
  targetY: number;
  facing: -1 | 1;
  energyRing: Phaser.GameObjects.Arc;
  lastTrailAt: number;
}

export class FightScene extends Phaser.Scene {
  private readonly network: NetworkClient;
  private readonly fighters = new Map<string, FighterView>();
  private unsubscribe?: () => void;
  private lastHitId = 0;
  private cameraTargetId?: string;
  private arena?: Phaser.GameObjects.Image;
  private currentArena: ArenaTheme = 'riftfall';

  constructor(network: NetworkClient) {
    super({ key: 'fight' });
    this.network = network;
  }

  preload(): void {
    this.load.image('riftfall-arena', '/assets/riftfall-arena.webp');
    this.load.image('ember-arena', '/assets/arena-ember-forge.webp');
    this.load.image('neon-arena', '/assets/arena-neon-ruins.webp');
    this.load.image('astral-arena', '/assets/arena-astral-sanctuary.webp');
  }

  create(): void {
    ensureFighterTextures(this);
    this.cameras.main.setBounds(0, 0, 2200, 900);
    this.cameras.main.setBackgroundColor('#071020');

    this.arena = this.add.image(1100, 450, 'riftfall-arena');
    this.arena.setDisplaySize(2200, 1238).setDepth(-20);

    const moonGlow = this.add.circle(850, 130, 190, 0xdbeafe, 0.06).setBlendMode(Phaser.BlendModes.ADD).setDepth(-18);
    this.tweens.add({ targets: moonGlow, alpha: { from: 0.03, to: 0.1 }, scale: { from: 0.94, to: 1.08 }, duration: 3_800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.rectangle(1100, 699, 2200, 5, 0xcbd5e1, 0.16).setDepth(-2);
    const mist = this.add.particles(0, 0, 'particle-white', {
      x: { min: 0, max: 2200 },
      y: { min: 685, max: 705 },
      lifespan: { min: 2_600, max: 5_000 },
      speedX: { min: -12, max: 12 },
      speedY: { min: -5, max: -18 },
      alpha: { start: 0.08, end: 0 },
      scale: { start: 0.9, end: 2.4 },
      tint: [0x93c5fd, 0xfca5a5, 0xffffff],
      frequency: 190,
      quantity: 1,
    });
    mist.setDepth(-1);

    this.unsubscribe = this.network.onSnapshot((snapshot) => this.consumeSnapshot(snapshot));
    this.scale.on('resize', this.resizeCamera, this);
    this.resizeCamera({ width: this.scale.width, height: this.scale.height } as Phaser.Structs.Size);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off('resize', this.resizeCamera, this);
    });
  }

  update(time: number): void {
    for (const view of this.fighters.values()) {
      view.sprite.x = Phaser.Math.Linear(view.sprite.x, view.targetX, 0.34);
      view.sprite.y = Phaser.Math.Linear(view.sprite.y, view.targetY, 0.34);
      view.shadow.x = view.sprite.x;
      view.shadow.y = 695;
      view.shadow.scaleX = Phaser.Math.Clamp(1 - Math.max(0, 690 - view.sprite.y) / 700, 0.45, 1);
      view.shadow.alpha = Phaser.Math.Clamp(0.3 - Math.max(0, 690 - view.sprite.y) / 1_000, 0.08, 0.3);
      view.name.setPosition(view.sprite.x, view.sprite.y - 207);
      view.energyRing.setPosition(view.sprite.x, view.sprite.y - 104);
      view.energyRing.setVisible(view.action === 'special');
      if (view.energyRing.visible) view.energyRing.rotation += 0.08;

      const frameCount = ACTION_FRAMES[view.action];
      const frame = Math.floor(time / ACTION_SPEED[view.action]) % frameCount;
      const key = fighterTextureKey(view.team, view.skin, view.color, view.action, frame);
      if (view.sprite.texture.key !== key) view.sprite.setTexture(key);
      view.sprite.setFlipX(view.facing === -1);

      if ((view.action === 'dash' || view.action === 'special') && time - view.lastTrailAt > 55) {
        view.lastTrailAt = time;
        const ghost = this.add.image(view.sprite.x, view.sprite.y, key)
          .setOrigin(0.5, 0.94)
          .setFlipX(view.facing === -1)
          .setAlpha(view.action === 'special' ? 0.28 : 0.2)
          .setTint(view.team === 'blue' ? 0x7dd3fc : 0xfda4af)
          .setDepth(2);
        this.tweens.add({
          targets: ghost,
          x: ghost.x - view.facing * (view.action === 'dash' ? 42 : 18),
          alpha: 0,
          scaleX: 1.08,
          scaleY: 1.04,
          duration: view.action === 'dash' ? 190 : 280,
          ease: 'Cubic.Out',
          onComplete: () => ghost.destroy(),
        });
      }
    }
  }

  private consumeSnapshot(snapshot: MatchSnapshot): void {
    if (snapshot.arena !== this.currentArena) {
      this.currentArena = snapshot.arena;
      const texture = {
        riftfall: 'riftfall-arena',
        ember: 'ember-arena',
        neon: 'neon-arena',
        astral: 'astral-arena',
      }[snapshot.arena];
      this.arena?.setTexture(texture).setDisplaySize(2200, 1238);
      this.cameras.main.flash(260, 255, 255, 255, false);
    }

    const liveIds = new Set(snapshot.players.map((player) => player.id));
    for (const [id, view] of this.fighters) {
      if (!liveIds.has(id)) {
        view.sprite.destroy();
        view.shadow.destroy();
        view.name.destroy();
        view.energyRing.destroy();
        this.fighters.delete(id);
      }
    }

    for (const player of snapshot.players) this.updateFighter(player);
    if (snapshot.hit && snapshot.hit.id !== this.lastHitId) {
      this.lastHitId = snapshot.hit.id;
      this.playHitEffect(snapshot.hit);
    }
  }

  private updateFighter(player: PlayerSnapshot): void {
    let view = this.fighters.get(player.id);
    if (!view) {
      ensureFighterTextures(this, player.team, player.skin, player.color);
      const shadow = this.add.ellipse(player.x, 695, 104, 24, 0x020617, 0.3).setDepth(0);
      const sprite = this.add.image(player.x, player.y, fighterTextureKey(player.team, player.skin, player.color, 'idle', 0))
        .setOrigin(0.5, 0.94)
        .setDepth(3);
      const name = this.add.text(player.x, player.y - 207, player.name.toUpperCase(), {
        fontFamily: 'Poppins, sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: player.team === 'blue' ? '#bae6fd' : '#fecdd3',
        stroke: '#020617',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(6);
      const energyRing = this.add.circle(player.x, player.y - 104, 76)
        .setStrokeStyle(3, player.team === 'blue' ? 0x7dd3fc : 0xfda4af, 0.7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
        .setDepth(2);
      view = {
        sprite,
        shadow,
        name,
        energyRing,
        team: player.team,
        skin: player.skin,
        color: player.color,
        action: 'idle',
        targetX: player.x,
        targetY: player.y,
        facing: player.facing,
        lastTrailAt: 0,
      };
      this.fighters.set(player.id, view);
    }

    view.targetX = player.x;
    view.targetY = player.y;
    view.facing = player.facing;
    if (view.action !== player.action) {
      view.action = player.action;
      if (player.action === 'hurt') {
        this.tweens.add({ targets: view.sprite, alpha: 0.25, duration: 45, yoyo: true, repeat: 2 });
      }
    }

    if (player.id === this.network.id && this.cameraTargetId !== player.id) {
      this.cameraTargetId = player.id;
      this.cameras.main.centerOn(player.x, player.y - 90);
      this.cameras.main.startFollow(view.sprite, true, 0.16, 0.16, 0, 95);
    }
  }

  private playHitEffect(hit: HitEvent): void {
    const color = hit.special ? 0xf8fafc : hit.blocked ? 0xfbbf24 : hit.kind === 'kick' ? 0xfde68a : 0xffffff;
    const isKick = hit.kind === 'kick';
    const burst = this.add.particles(hit.x, hit.y, 'particle-white', {
      speed: { min: hit.special ? 160 : isKick ? 120 : 90, max: hit.special ? 420 : isKick ? 320 : 250 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 180, max: 430 },
      scale: { start: hit.special ? 1.1 : 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: color,
      quantity: hit.special ? 28 : isKick ? 20 : 14,
      emitting: false,
    }).setDepth(12);
    burst.explode(hit.special ? 28 : isKick ? 20 : 14);

    const ring = this.add.circle(hit.x, hit.y, 14).setStrokeStyle(hit.special ? 8 : 5, color, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(11);
    this.tweens.add({
      targets: ring,
      radius: hit.special ? 120 : 60,
      alpha: 0,
      duration: hit.special ? 360 : 220,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
    this.time.delayedCall(500, () => burst.destroy());

    if (hit.targetId === this.network.id) {
      this.cameras.main.shake(hit.special ? 210 : isKick ? 135 : 95, hit.special ? 0.012 : isKick ? 0.008 : 0.006);
    }
  }

  private resizeCamera(gameSize: Phaser.Structs.Size): void {
    const width = Number(gameSize.width || this.scale.width);
    const height = Number(gameSize.height || this.scale.height);
    const isPhoneLandscape = width < 1_000 && width > height;
    const zoom = isPhoneLandscape ? 0.9 : Phaser.Math.Clamp(Math.min(width / 1_350, height / 760), 0.82, 1.14);
    this.cameras.main.setZoom(zoom);
  }
}
