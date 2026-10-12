import Phaser from 'phaser';
import { PILOTS } from '../../shared/config/pilots.ts';
import type { LobbyPlayer, ServerMsg } from '../../shared/protocol.ts';
import { MenuNav } from '../input/MenuNav.ts';
import { NetClient } from '../net/NetClient.ts';
import { sfx } from '../render/Audio.ts';
import { H, state, W } from '../state.ts';
import { C, makeText, panel } from '../ui.ts';
import { REJOIN_KEY } from './Menu.ts';

/**
 * Host: shows the room code and waits for a partner. Join: type the code. Rejoin: reconnect to a running match.
 */
export class LobbyScene extends Phaser.Scene {
  private nav!: MenuNav;
  private net!: NetClient;
  private code = '';
  private typed = '';
  private status = '';
  private players: LobbyPlayer[] = [];
  private hostSlot = 0;
  private mySlot = -1;
  private connecting = false;
  private codeText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private listText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private onKey = (ev: KeyboardEvent) => this.handleKey(ev);

  constructor() {
    super('Lobby');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.bgDark);
    this.nav = new MenuNav(this, false);
    this.code = '';
    this.typed = '';
    this.status = '';
    this.players = [];
    this.mySlot = -1;
    this.connecting = false;

    const titles = { host: 'HOST CO-OP', join: 'JOIN CO-OP', rejoin: 'REJOIN MATCH', solo: '' } as const;
    makeText(this, W / 2, 40, titles[state.mode], 44, 'center', '#e6ffc8');
    panel(this, 300, 150, 680, 360);
    this.codeText = makeText(this, W / 2, 190, '', 64, 'center', '#ffffff');
    this.listText = makeText(this, 340, 330, '', 24);
    this.listText.setWordWrapWidth(600);
    this.statusText = makeText(this, W / 2, 540, '', 22, 'center');
    this.hintText = makeText(this, W - 56, H - 56, '', 18, 'right');

    this.net = new NetClient();
    this.net.onMessage = (m) => this.onMsg(m);
    this.net.onClose = () => {
      if (this.scene.isActive('Lobby')) this.status = 'Disconnected from server.';
    };
    state.net = this.net;

    this.input.keyboard!.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', this.onKey));

    const autoCode = new URLSearchParams(location.search).get('code');
    if (state.mode === 'join' && autoCode) {
      this.typed = autoCode.toUpperCase().slice(0, 4);
      void this.open({ t: 'join', code: this.typed, pilot: state.pilot, special: state.special });
    } else if (state.mode === 'host') void this.open({ t: 'create', pilot: state.pilot, special: state.special });
    else if (state.mode === 'rejoin') {
      try {
        const saved = JSON.parse(sessionStorage.getItem(REJOIN_KEY) ?? 'null') as { code: string; slot: number; token: string } | null;
        if (saved) void this.open({ t: 'rejoin', code: saved.code, slot: saved.slot, token: saved.token });
        else this.status = 'Nothing to rejoin.';
      } catch {
        this.status = 'Nothing to rejoin.';
      }
    }
  }

  private async open(first: Parameters<NetClient['send']>[0]): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    this.status = 'Connecting...';
    try {
      await this.net.connect();
      this.net.send(first);
      this.status = '';
    } catch (e) {
      this.status = e instanceof Error ? e.message : 'Connection failed';
      this.connecting = false;
    }
  }

  private onMsg(m: ServerMsg): void {
    if (m.t === 'joined') {
      this.code = m.code;
      this.mySlot = m.slot;
      state.slot = m.slot;
      state.roomCode = m.code;
      sessionStorage.setItem(REJOIN_KEY, JSON.stringify({ code: m.code, slot: m.slot, token: m.token }));
    } else if (m.t === 'lobby') {
      this.code = m.code;
      this.players = m.players;
      this.hostSlot = m.hostSlot;
    } else if (m.t === 'start') {
      state.slot = m.slot;
      state.seed = m.seed;
      state.mode = state.mode === 'host' || state.mode === 'join' ? state.mode : 'join';
      sfx.callout();
      this.scene.start('Game');
    } else if (m.t === 'error') {
      this.status = m.msg;
      this.connecting = false;
      if (state.mode === 'rejoin') sessionStorage.removeItem(REJOIN_KEY);
    }
  }

  private handleKey(ev: KeyboardEvent): void {
    sfx.unlock();
    if (state.mode !== 'join' || this.mySlot >= 0) return;
    if (/^[a-zA-Z]$/.test(ev.key) && this.typed.length < 4) this.typed += ev.key.toUpperCase();
    else if (ev.key === 'Backspace') this.typed = this.typed.slice(0, -1);
  }

  update(): void {
    const n = this.nav.poll();
    if (n.back) {
      sessionStorage.removeItem(REJOIN_KEY);
      this.scene.start('Menu');
      return;
    }

    if (state.mode === 'join' && this.mySlot < 0) {
      this.codeText.setText(this.typed.padEnd(4, '_').split('').join(' '));
      this.listText.setText('Type the 4-letter room code\nyour partner shows.');
      this.hintText.setText('ENTER join    BACKSPACE edit    ESC back');
      if (n.ok && this.typed.length === 4) {
        void this.open({ t: 'join', code: this.typed, pilot: state.pilot, special: state.special });
        // the server answers with joined/lobby or an error; allow another try after an error
      }
    } else {
      this.codeText.setText(this.code ? this.code.split('').join(' ') : '...');
      const lines = this.players.map((p) => {
        const you = p.slot === this.mySlot ? ' (you)' : '';
        const host = p.slot === this.hostSlot ? ' [host]' : '';
        return `PILOT ${p.slot + 1}: ${PILOTS[p.pilot].name}${host}${you}`;
      });
      if (this.players.length < 2 && state.mode !== 'rejoin') lines.push('PILOT 2: waiting for partner...');
      this.listText.setText(lines.join('\n'));
      const isHost = this.mySlot === this.hostSlot && this.mySlot >= 0;
      if (state.mode === 'host' || isHost) {
        this.hintText.setText(this.players.length >= 2 ? 'ENTER start the match    ESC leave' : 'Share the code    ESC leave');
        if (n.ok && this.players.length >= 2) this.net.send({ t: 'start' });
      } else {
        this.hintText.setText('Waiting for the host to start    ESC leave');
      }
    }
    this.statusText.setText(this.status);
    if (this.status && state.mode === 'join' && this.mySlot < 0 && this.typed.length === 4) this.connecting = false;
  }
}
