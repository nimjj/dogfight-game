/**
 * Dev helper: hosts a co-op room with a bot pilot so you can test joining from a browser alone.
 *   npm run bot-host        -> prints the room code; join it from the game (JOIN CO-OP)
 * The bot starts the match as soon as a second pilot joins, then flies and shoots.
 */
import WebSocket from 'ws';
import type { ClientMsg, ServerMsg, Snapshot } from '../src/shared/protocol.ts';
import { angleDiff } from '../src/shared/math.ts';
import { createGameServer } from '../src/server/server.ts';

const port = Number(process.env['PORT'] ?? 2567);
const server = await createGameServer({ port });
console.log(`server on :${server.port}`);

const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
const send = (m: ClientMsg) => ws.send(JSON.stringify(m));
let snap: Snapshot | null = null;
let seq = 0;
let started = false;

ws.on('open', () => send({ t: 'create', pilot: 'bulldog', special: 'emp' }));
ws.on('message', (d) => {
  const m = JSON.parse(String(d)) as ServerMsg;
  if (m.t === 'joined') console.log(`ROOM CODE: ${m.code}`);
  else if (m.t === 'lobby' && m.players.length >= 2 && !started) {
    started = true;
    setTimeout(() => send({ t: 'start' }), 300);
  } else if (m.t === 'snap') snap = m.s;
});

setInterval(() => {
  if (!started || !snap) return;
  const me = snap.planes.find((p) => p.kind === 'player' && p.slot === 0);
  let turn = 0;
  let gun = false;
  if (me) {
    let best = Infinity;
    let tx = me.x + 100;
    let ty = me.y;
    for (const p of snap.planes) {
      if (p.team === me.team) continue;
      const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
      if (d < best) {
        best = d;
        tx = p.x;
        ty = p.y;
      }
    }
    let desired = Math.atan2(ty - me.y, tx - me.x);
    if (me.y > 1500 && Math.sin(me.heading) > -0.2) desired = -Math.PI / 2;
    const diff = angleDiff(me.heading, desired);
    turn = Math.max(-1, Math.min(1, diff * 3));
    gun = Math.abs(diff) < 0.15 && best < 800 * 800;
  }
  send({ t: 'input', seq: ++seq, i: { turn, thrust: true, gun, missile: false, special: false, flare: false } });
}, 1000 / 60);
