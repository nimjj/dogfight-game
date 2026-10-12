import Phaser from 'phaser';
import { GROUND_Y } from '../../shared/constants.ts';
import { clamp } from '../../shared/math.ts';
import type { Snapshot } from '../../shared/protocol.ts';
import { NO_INPUT } from '../../shared/types.ts';
import { botInput } from '../bot.ts';
import { InputMap } from '../input/InputMap.ts';
import { sfx } from '../render/Audio.ts';
import { Background } from '../render/Background.ts';
import { Effects } from '../render/Effects.ts';
import { EntityRenderer } from '../render/EntityRenderer.ts';
import { OnlineSession } from '../session/OnlineSession.ts';
import type { Session } from '../session/Session.ts';
import { SoloSession } from '../session/SoloSession.ts';
import { H, state, W } from '../state.ts';
import { C, makeText } from '../ui.ts';

const SOLO_ZOOM = 0.8;

export class GameScene extends Phaser.Scene {
  view: Snapshot | null = null;
  worldCam!: Phaser.Cameras.Scene2D.Camera;
  localSlot = 0;
  /** True while an enemy missile is homing on the local plane. */
  warning = false;
  /** Short centre-screen message (connection lost, leave hint...). */
  notice = '';

  private session!: Session;
  private inputMap!: InputMap;
  private entities!: EntityRenderer;
  private effects!: Effects;
  private bg!: Background;
  private ov!: Phaser.GameObjects.Graphics;
  private lockText!: Phaser.GameObjects.Text;
  private camX = 2000;
  private camY = 700;
  private zoom = SOLO_ZOOM;
  private lastHp = -1;
  private endTimer = 0;
  private lostTimer = 0;
  private lastEsc = -9999;
  private bot = false;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Game');
  }

  create(): void {
    this.view = null;
    this.warning = false;
    this.notice = '';
    this.endTimer = 0;
    this.lostTimer = 0;
    this.lastHp = -1;
    this.lastEsc = -9999;
    this.camX = 1600;
    this.camY = 700;
    this.zoom = SOLO_ZOOM;
    this.bot = new URLSearchParams(location.search).get('bot') === '1';

    const bgLayer = this.add.layer();
    const worldLayer = this.add.layer();
    const bgCam = this.cameras.main;
    bgCam.setBackgroundColor(C.sky);
    bgCam.ignore(worldLayer);
    this.worldCam = this.cameras.add(0, 0, W, H);
    this.worldCam.ignore(bgLayer);

    this.bg = new Background(this, bgLayer, worldLayer);
    this.entities = new EntityRenderer(this, worldLayer);
    this.effects = new Effects(this, worldLayer);
    this.ov = this.add.graphics().setDepth(20);
    worldLayer.add(this.ov);
    this.lockText = makeText(this, 0, 0, 'LOCKED', 14, 'center').setDepth(21).setVisible(false);
    worldLayer.add(this.lockText);

    if (state.mode === 'solo') {
      this.session = new SoloSession(state.pilot, state.special);
    } else if (state.net) {
      this.session = new OnlineSession(state.net, state.slot);
    } else {
      this.scene.start('Menu');
      return;
    }
    this.localSlot = this.session.localSlot;
    this.inputMap = new InputMap(this);
    this.escKey = this.input.keyboard!.addKey('ESC');

    this.scene.launch('Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.session.destroy();
      this.scene.stop('Hud');
    });
  }

  update(time: number, delta: number): void {
    if (!this.session) return;
    const dt = Math.min(delta, 100) / 1000;

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (time - this.lastEsc < 2000) {
        this.leave();
        return;
      }
      this.lastEsc = time;
    }
    this.notice = time - this.lastEsc < 2000 ? 'Press ESC again to leave' : '';

    const prevView = this.view;
    const input = this.bot && prevView ? botInput(prevView, this.localSlot, time) : this.inputMap.read();
    this.session.update(delta, this.session.connectionLost() ? NO_INPUT : input);
    const v = this.session.view();
    if (!v) {
      this.notice = 'Waiting for the server...';
      this.effects.update(dt, null, time);
      return;
    }
    this.view = v;

    if (this.session.connectionLost()) {
      this.notice = 'Connection lost';
      this.lostTimer += delta;
      if (this.lostTimer > 2500) this.leave();
    }

    const me = v.planes.find((p) => p.kind === 'player' && p.slot === this.localSlot);
    this.warning = !!me && v.missiles.some((m) => m.team === 1 && m.targetId === me.id);
    if (this.warning) sfx.warn();

    // gameplay events -> visuals, sound, HUD callouts
    for (const ev of this.session.drainEvents()) {
      this.effects.handle(ev, this.camX, this.camY);
      if (ev.t === 'callout') {
        if (ev.slot === -1 || ev.slot === this.localSlot) {
          this.game.events.emit('callout', ev.text);
          sfx.callout();
        }
      } else if (ev.t === 'lock' && ev.slot === this.localSlot) sfx.lock();
      else if (ev.t === 'overheat' && ev.slot === this.localSlot) sfx.overheat();
      else if (ev.t === 'respawn' && ev.slot === this.localSlot) sfx.respawn();
      else if (ev.t === 'gameover') sfx.gameOver();
      else if (ev.t === 'explosion' && Math.hypot(ev.x - this.camX, ev.y - this.camY) < 700) {
        this.worldCam.shake(140, 0.0025 * ev.size);
      }
    }
    if (me) {
      if (this.lastHp >= 0 && me.hp < this.lastHp) this.worldCam.shake(160, 0.006);
      this.lastHp = me.hp;
    } else this.lastHp = -1;

    this.entities.render(v, time);
    this.effects.update(dt, v, time);
    this.moveCamera(v, me, dt);
    this.bg.update(this.camX, this.camY);
    this.drawOverlay(v, me, time);

    if (v.gameOver) {
      this.endTimer += delta;
      if (this.endTimer > 2200) this.finish(v);
    }
  }

  private moveCamera(v: Snapshot, me: Snapshot['planes'][number] | undefined, dt: number): void {
    const alive = v.planes.filter((p) => p.kind === 'player');
    let tx = this.camX;
    let ty = this.camY;
    let zoom = SOLO_ZOOM;
    if (alive.length >= 2) {
      const a = alive[0]!;
      const b = alive[1]!;
      tx = (a.x + b.x) / 2;
      ty = (a.y + b.y) / 2;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      zoom = clamp(Math.min(W / (dx + 800), H / (dy + 560)), 0.45, 0.85);
    } else if (alive.length === 1) {
      const p = alive[0]!;
      tx = p.x + Math.cos(p.heading) * p.speed * 0.25;
      ty = p.y + Math.sin(p.heading) * p.speed * 0.25;
    }
    void me;
    const k = 1 - Math.exp(-dt * 5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.zoom += (zoom - this.zoom) * (1 - Math.exp(-dt * 3));
    const halfH = H / 2 / this.zoom;
    const cy = clamp(this.camY, halfH - 200, GROUND_Y + 160 - halfH);
    this.worldCam.setZoom(this.zoom);
    this.worldCam.centerOn(this.camX, cy);
  }

  private drawOverlay(v: Snapshot, me: Snapshot['planes'][number] | undefined, time: number): void {
    const g = this.ov;
    g.clear();

    // health bars over damaged planes
    for (const p of v.planes) {
      if (p.hp >= p.maxHp || p.id === me?.id) continue;
      const w = 40;
      g.fillStyle(0x1f2b21, 0.8).fillRect(p.x - w / 2, p.y - 34, w, 5);
      g.fillStyle(p.team === 0 ? C.light : C.bright, 1).fillRect(p.x - w / 2, p.y - 34, w * (p.hp / p.maxHp), 5);
    }

    // "you are here" marker over the local plane
    if (me) {
      g.fillStyle(C.light, 1).fillTriangle(me.x - 7, me.y - 44, me.x + 7, me.y - 44, me.x, me.y - 34);
    }

    // lock-on reticle
    this.lockText.setVisible(false);
    const target = me && me.lockId ? v.planes.find((p) => p.id === me.lockId) : undefined;
    if (target) {
      const a = time / 500;
      g.lineStyle(3, 0xffffff, 1);
      for (const rot of [a, a + Math.PI / 4]) {
        const s = 30;
        const pts = [0, 1, 2, 3].map((i) => {
          const ang = rot + (i * Math.PI) / 2;
          return { x: target.x + Math.cos(ang) * s, y: target.y + Math.sin(ang) * s };
        });
        g.strokePoints(pts, true);
      }
      this.lockText.setPosition(target.x, target.y + 42).setVisible(true);
    }
  }

  private finish(v: Snapshot): void {
    state.last = {
      score: v.score,
      wave: v.wave,
      kills: v.players.reduce((n, p) => n + p.kills, 0),
      coop: this.session.coop,
    };
    this.scene.start('GameOver');
  }

  private leave(): void {
    this.scene.start('Menu');
  }
}
