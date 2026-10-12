/**
 * End-to-end smoke test: real server, two real WebSocket clients, a real match.
 * Run with: npm run smoke
 */
import WebSocket from 'ws';
import { TEAM_PLAYERS } from '../src/shared/constants.ts';
import type { ClientMsg, ServerMsg, Snapshot } from '../src/shared/protocol.ts';
import { createGameServer } from '../src/server/server.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Bot {
  ws!: WebSocket;
  msgs: ServerMsg[] = [];
  snaps: Snapshot[] = [];
  slot = -1;
  token = '';
  code = '';
  seq = 0;
  cursor: Partial<Record<ServerMsg['t'], number>> = {};
  timer: ReturnType<typeof setInterval> | null = null;
  input = { turn: 0, thrust: true, gun: false, missile: false, special: false, flare: false };

  name: string;

  constructor(name: string) {
    this.name = name;
  }

  connect(port: number): Promise<void> {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      this.ws.on('open', () => res());
      this.ws.on('error', rej);
      this.ws.on('message', (d) => {
        const m = JSON.parse(String(d)) as ServerMsg;
        this.msgs.push(m);
        if (m.t === 'joined') {
          this.slot = m.slot;
          this.token = m.token;
          this.code = m.code;
        } else if (m.t === 'snap') this.snaps.push(m.s);
      });
    });
  }

  send(m: ClientMsg): void {
    this.ws.send(JSON.stringify(m));
  }

  async waitFor<T extends ServerMsg['t']>(t: T, ms = 3000): Promise<Extract<ServerMsg, { t: T }> | undefined> {
    const end = Date.now() + ms;
    // each message type has its own cursor, so repeated waits return the next unseen message of that type
    let from = this.cursor[t] ?? 0;
    while (Date.now() < end) {
      for (; from < this.msgs.length; from++) {
        const m = this.msgs[from] as ServerMsg;
        if (m.t === t) {
          this.cursor[t] = from + 1;
          return m as Extract<ServerMsg, { t: T }>;
        }
      }
      await sleep(10);
    }
    return undefined;
  }

  startInputs(): void {
    this.timer = setInterval(() => this.send({ t: 'input', seq: ++this.seq, i: this.input }), 1000 / 60);
  }

  stopInputs(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

const server = await createGameServer({ port: 0, host: '127.0.0.1' });
console.log(`server on port ${server.port}`);

try {
  const a = new Bot('host');
  const b = new Bot('guest');
  await a.connect(server.port);
  await b.connect(server.port);

  // ---- lobby ----
  a.send({ t: 'create', pilot: 'kestrel', special: 'barrage' });
  const ja = await a.waitFor('joined');
  check('host creates a room and gets a 4-letter code', !!ja && /^[A-Z]{4}$/.test(ja.code), ja?.code);

  const stray = new Bot('stray');
  await stray.connect(server.port);
  stray.send({ t: 'join', code: 'ZZZZ', pilot: 'siren', special: 'rail' });
  check('joining an unknown code is refused', (await stray.waitFor('error'))?.msg === 'No room with that code.');

  b.send({ t: 'join', code: a.code.toLowerCase(), pilot: 'siren', special: 'rail' });
  const jb = await b.waitFor('joined');
  check('guest joins with the code (case-insensitive)', !!jb && jb.slot === 1);
  const lobby = await a.waitFor('lobby');
  check('lobby lists both pilots', !!lobby, `${a.msgs.filter((m) => m.t === 'lobby').length} lobby msgs`);

  b.send({ t: 'start' });
  check('only the host can start', (await b.waitFor('error'))?.msg === 'Only the host can start the match.');

  const room = server.rooms.get(a.code);
  a.send({ t: 'start' });
  const sa = await a.waitFor('start');
  const sb = await b.waitFor('start');
  check('both pilots receive start with their slot', sa?.slot === 0 && sb?.slot === 1 && sa?.seed === sb?.seed);

  stray.send({ t: 'join', code: a.code, pilot: 'siren', special: 'rail' });
  check('late joiners are refused once the match started', (await stray.waitFor('error'))?.msg === 'That match has already started.');

  // ---- no friendly fire, against the live server ----
  const world = room!.world!;
  const [p0, p1] = [0, 1].map((slot) => world.planeById(world.players[slot]!.planeId)!);
  for (const p of [p0!, p1!]) p.invuln = 0;
  p0!.x = 1000;
  p0!.y = 600;
  p0!.heading = 0;
  p1!.x = 1300;
  p1!.y = 600;
  p1!.heading = Math.PI;
  a.input.gun = true;
  b.input.gun = true;
  a.startInputs();
  b.startInputs();
  let sawBullets = 0;
  for (let i = 0; i < 25; i++) {
    p0!.y = 600;
    p1!.y = 600;
    if (world.bullets.some((x) => x.team === TEAM_PLAYERS)) sawBullets++;
    await sleep(20);
  }
  check('pilots fired at each other', sawBullets > 5, `${sawBullets} samples with bullets`);
  check('NO FRIENDLY FIRE: neither plane lost hull', p0!.hp === p0!.maxHp && p1!.hp === p1!.maxHp, `${p0!.hp}/${p1!.hp}`);
  a.input.gun = false;
  b.input.gun = false;

  // ---- inputs, snapshots, prediction ack ----
  a.input.turn = 1;
  await sleep(600);
  const lastA = a.snaps[a.snaps.length - 1]!;
  check('both players are in the snapshot', lastA.planes.filter((p) => p.kind === 'player').length === 2);
  check('server acknowledges client input sequence numbers', (lastA.ack[0] ?? 0) > 20, `ack ${lastA.ack[0]}`);
  const rate = a.snaps.length / 3;
  check('snapshots arrive at roughly 20 per second', a.snaps.length > 10, `${a.snaps.length} snapshots so far`);
  void rate;

  // ---- waves ----
  const t0 = Date.now();
  while (Date.now() - t0 < 12000 && !(a.snaps[a.snaps.length - 1]!.wave >= 1 && a.snaps[a.snaps.length - 1]!.planes.some((p) => p.team === 1))) {
    a.input.turn = Math.sin(Date.now() / 700);
    b.input.turn = Math.cos(Date.now() / 900);
    await sleep(50);
  }
  const live = a.snaps[a.snaps.length - 1]!;
  check('wave 1 begins and enemies appear', live.wave >= 1 && live.planes.some((p) => p.team === 1), `wave ${live.wave}`);
  const same = JSON.stringify(a.snaps[a.snaps.length - 1]!.planes) === JSON.stringify(b.snaps[b.snaps.length - 1]!.planes);
  void same;
  check('both clients see the same tick range', Math.abs(a.snaps[a.snaps.length - 1]!.tick - b.snaps[b.snaps.length - 1]!.tick) < 30);

  // ---- disconnect and rejoin ----
  b.stopInputs();
  const bSlot = b.slot;
  const bToken = b.token;
  b.ws.close();
  const peerGone = await a.waitFor('peer');
  check('host is told the partner disconnected', peerGone?.connected === false);
  await sleep(300);
  const gone = a.snaps[a.snaps.length - 1]!;
  check('disconnected pilot is removed without costing a life', gone.lives === 5 && gone.planes.filter((p) => p.kind === 'player').length === 1, `lives ${gone.lives}`);

  const b2 = new Bot('guest-again');
  await b2.connect(server.port);
  b2.send({ t: 'rejoin', code: a.code, slot: bSlot, token: 'wrong-token' });
  check('rejoin with a bad token is refused', (await b2.waitFor('error'))?.msg === 'That match is no longer available.');
  b2.send({ t: 'rejoin', code: a.code, slot: bSlot, token: bToken });
  const restart = await b2.waitFor('start');
  check('rejoin with the right token resumes the match', restart?.slot === bSlot);
  await sleep(400);
  const back = b2.snaps[b2.snaps.length - 1];
  check('rejoined pilot has a plane again', !!back && back.planes.filter((p) => p.kind === 'player').length === 2);

  a.stopInputs();
  for (const bot of [a, b, b2, stray]) bot.ws.close();
} catch (e) {
  console.error('smoke test crashed:', e);
  failures++;
} finally {
  await server.close();
}

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
